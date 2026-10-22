#!/usr/bin/env bash
# Runs the database security tests on a throwaway PostgreSQL database.
# Needs PostgreSQL installed. GitHub Actions does this automatically (see .github/workflows/ci.yml).
set -euo pipefail
DB=${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to an EMPTY test database, e.g. postgres://postgres:postgres@localhost:5432/gemvault_test}
cd "$(dirname "$0")/.."
psql "$DB" -v ON_ERROR_STOP=1 -q -c "drop schema if exists public cascade; drop schema if exists auth cascade; drop schema if exists t cascade; create schema public;"
psql "$DB" -v ON_ERROR_STOP=1 -q -f supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do psql "$DB" -v ON_ERROR_STOP=1 -q -f "$f"; done
if out=$(psql "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql 2>&1); then
  echo "$out" | grep -E "PASS|ALL SECURITY" | sed 's/^.*NOTICE:  //'
  echo "Security tests finished: all passed."
else
  echo "$out" | grep -E "PASS|FAIL|ERROR" | sed 's/^.*\(NOTICE\|ERROR\):  //'
  echo "Security tests FAILED." >&2
  exit 1
fi
