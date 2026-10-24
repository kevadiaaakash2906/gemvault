#!/usr/bin/env bash
# Many people recording payments at the same moment must never take a memo past its bill.
set -euo pipefail
DB=$1
OWNER=00000000-0000-0000-0000-000000000001
as_owner () { psql "$DB" -q -At -v ON_ERROR_STOP=1 -c "select set_config('request.jwt.claim.sub','$OWNER',false)" -c "set role authenticated" -c "$1" 2>/dev/null | tail -1; }
TMP=$(mktemp -d)

as_owner "select public.save_order('{\"style_no\":\"RACE-1\",\"sold_to\":\"RACE BUYER\",\"memo_no\":\"RACE1\",\"sale_price\":\"500\"}'::jsonb)" >/dev/null
MEMO=$(psql "$DB" -q -At -c "select id from public.memos where memo_no='RACE1'")

# Test 1: bill 500, twelve people each pay 100 at once -> exactly 5 succeed.
for i in $(seq 1 12); do
  ( psql "$DB" -q -At -v ON_ERROR_STOP=1 -c "select set_config('request.jwt.claim.sub','$OWNER',false)" -c "set role authenticated" \
      -c "select public.record_payment('$MEMO', 100, '2026-10-24', 'race-$i')" >/dev/null 2>&1 && echo ok > "$TMP/a$i" || echo no > "$TMP/a$i" ) &
done
wait
OKS=$(cat "$TMP"/a* | grep -c ok || true)
PAID=$(psql "$DB" -q -At -c "select total_paid from public.memo_summary where id='$MEMO'")
[ "$OKS" = "5" ] && [ "$PAID" = "500.00" ] || { echo "FAIL [overpayment]: $OKS payments accepted, paid $PAID (expected 5 and 500.00)" >&2; exit 1; }
echo "PASS  12 simultaneous payments of 100 on a 500 bill: exactly 5 accepted, the memo was never overpaid"

# Test 2: the same payment (same key) sent 8 times at once -> recorded once.
as_owner "select public.save_order('{\"style_no\":\"RACE-2\",\"sold_to\":\"RACE BUYER\",\"memo_no\":\"RACE1\",\"sale_price\":\"1000\"}'::jsonb)" >/dev/null
for i in $(seq 1 8); do
  ( psql "$DB" -q -At -v ON_ERROR_STOP=1 -c "select set_config('request.jwt.claim.sub','$OWNER',false)" -c "set role authenticated" \
      -c "select public.record_payment('$MEMO', 70, '2026-10-24', 'same-key')" >/dev/null 2>&1 || true ) &
done
wait
CNT=$(psql "$DB" -q -At -c "select count(*) from public.payments where idempotency_key='same-key'")
[ "$CNT" = "1" ] || { echo "FAIL [double submit]: $CNT payments recorded (expected 1)" >&2; exit 1; }
echo "PASS  the same payment sent 8 times at once was recorded exactly once"
rm -rf "$TMP"
