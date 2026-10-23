#!/usr/bin/env bash
# Many people pressing "remove stock" at the same moment must never oversell.
set -euo pipefail
DB=$1
OWNER=00000000-0000-0000-0000-000000000001
as_owner () { psql "$DB" -q -At -v ON_ERROR_STOP=1 -c "select set_config('request.jwt.claim.sub','$OWNER',false)" -c "set role authenticated" -c "$1" 2>/dev/null | tail -1; }
LOC=$(psql "$DB" -q -At -c "select id from public.stock_locations where name='Main store'")
TMP=$(mktemp -d)

# Test 1: 5 in stock, 12 simultaneous removals of 1 -> exactly 5 may succeed.
P1=$(as_owner "select public.save_product('{\"sku\":\"RACE-1\",\"name\":\"Race item\",\"category\":\"Test\",\"tracking\":\"quantity\"}'::jsonb)")
as_owner "select public.record_opening_stock('$P1','$LOC',5)" >/dev/null
for i in $(seq 1 12); do
  ( psql "$DB" -q -At -v ON_ERROR_STOP=1 -c "select set_config('request.jwt.claim.sub','$OWNER',false)" -c "set role authenticated" \
      -c "select public.adjust_stock('$P1','$LOC',-1,'race test')" >/dev/null 2>&1 && echo ok > "$TMP/a$i" || echo no > "$TMP/a$i" ) &
done
wait
OKS=$(cat "$TMP"/a* | grep -c ok || true)
QTY=$(psql "$DB" -q -At -c "select quantity from public.stock_levels where product_id='$P1'")
[ "$OKS" = "5" ] && [ "$QTY" = "0" ] || { echo "FAIL [overselling]: $OKS succeeded, quantity left $QTY (expected 5 and 0)" >&2; exit 1; }
echo "PASS  12 simultaneous removals of the last 5 items: exactly 5 succeeded, stock never went negative"

# Test 2: the same request (same key) sent 8 times at once -> counted once.
P2=$(as_owner "select public.save_product('{\"sku\":\"RACE-2\",\"name\":\"Retry item\",\"category\":\"Test\",\"tracking\":\"quantity\"}'::jsonb)")
as_owner "select public.record_opening_stock('$P2','$LOC',10)" >/dev/null
for i in $(seq 1 8); do
  ( psql "$DB" -q -At -v ON_ERROR_STOP=1 -c "select set_config('request.jwt.claim.sub','$OWNER',false)" -c "set role authenticated" \
      -c "select public.adjust_stock('$P2','$LOC',-1,'double click','same-key')" >/dev/null 2>&1 || true ) &
done
wait
QTY2=$(psql "$DB" -q -At -c "select quantity from public.stock_levels where product_id='$P2'")
MOV=$(psql "$DB" -q -At -c "select count(*) from public.stock_movements where idempotency_key='same-key'")
[ "$QTY2" = "9" ] && [ "$MOV" = "1" ] || { echo "FAIL [double submit]: quantity $QTY2, history rows $MOV (expected 9 and 1)" >&2; exit 1; }
echo "PASS  same request sent 8 times at once was applied exactly once"
rm -rf "$TMP"
