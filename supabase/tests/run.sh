#!/usr/bin/env bash
# Rejoue les migrations + la démo + les tests sur un PostgreSQL local vierge.
# Usage : PGHOST=/tmp/pg PGPORT=5544 PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-blacklane_test}
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
for f in tests/00_supabase_stub.sql migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -1 -f "$f"; done
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f seed_demo.sql > /dev/null
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f tests/10_tests.sql
