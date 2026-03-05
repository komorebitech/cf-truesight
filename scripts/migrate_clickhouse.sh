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

run_statement() {
    local stmt="$1"
    local file="$2"
    response=$(echo "$stmt" | curl -s -w "\n%{http_code}" --data-binary @- "$CLICKHOUSE_URL")
    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | sed '$d')
    if [ "$http_code" != "200" ]; then
        echo "FAILED (HTTP $http_code)"
        echo "Error: $body"
        echo "File: $file"
        exit 1
    fi
}

for file in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
    filename="$(basename "$file")"
    echo -n "Running migration: $filename ... "

    # Use perl to split SQL file into individual statements on semicolons,
    # preserving content within strings.
    # Also replace the hardcoded database name with the configured one.
    perl -0777 -pe "s/truesight_local/$ENV{CLICKHOUSE_DATABASE}/g" "$file" | \
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

    echo "done."
done

echo "---"
echo "All ClickHouse migrations applied successfully."
