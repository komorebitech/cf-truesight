#!/usr/bin/env bash
set -euo pipefail

CLICKHOUSE_URL="${CLICKHOUSE_URL:-http://localhost:8123}"
CLICKHOUSE_DATABASE="${CLICKHOUSE_DATABASE:-truesight_local}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/../clickhouse-migrations"

echo "ClickHouse URL: $CLICKHOUSE_URL"
echo "ClickHouse Database: $CLICKHOUSE_DATABASE"
echo "Migrations dir: $MIGRATIONS_DIR"
echo "---"

run_query() {
    local stmt="$1"
    response=$(echo "$stmt" | curl -s -w "\n%{http_code}" --data-binary @- "$CLICKHOUSE_URL")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" != "200" ]; then
        echo "$body"
        return 1
    fi
    echo "$body"
}

run_statement() {
    local stmt="$1"
    local file="$2"
    body=$(run_query "$stmt") || {
        echo "FAILED"
        echo "Error: $body"
        echo "File: $file"
        exit 1
    }
}

# Create migrations tracking table (idempotent)
run_query "CREATE TABLE IF NOT EXISTS ${CLICKHOUSE_DATABASE}.schema_migrations (
    filename String,
    applied_at DateTime DEFAULT now()
) ENGINE = MergeTree() ORDER BY filename" > /dev/null || {
    echo "WARNING: Could not create schema_migrations table, running all migrations"
}

# Get list of already-applied migrations
applied=$(run_query "SELECT filename FROM ${CLICKHOUSE_DATABASE}.schema_migrations ORDER BY filename" 2>/dev/null || echo "")

for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
    filename="$(basename "$file")"

    # Skip already-applied migrations
    if echo "$applied" | grep -qF "$filename"; then
        echo "Skipping migration: $filename (already applied)"
        continue
    fi

    echo -n "Running migration: $filename ... "

    # Use perl to split SQL file into individual statements on semicolons,
    # preserving content within strings.
    # Also replace the hardcoded database name with the configured one.
    perl -0777 -pe 's/truesight_local/'"$CLICKHOUSE_DATABASE"'/g' "$file" | \
    perl -0777 -ne '
        # Split on semicolons followed by optional whitespace
        my @stmts = split(/;\s*/, $_);
        for my $s (@stmts) {
            $s =~ s/^\s+|\s+$//gs;
            next if $s eq "";
            # Print each statement followed by a NUL byte delimiter
            print "$s\0";
        }
    ' | while IFS= read -r -d $'\0' stmt; do
        run_statement "$stmt" "$filename"
    done

    # Record migration as applied
    run_query "INSERT INTO ${CLICKHOUSE_DATABASE}.schema_migrations (filename) VALUES ('${filename}')" > /dev/null

    echo "done."
done

echo "---"
echo "All ClickHouse migrations applied successfully."
