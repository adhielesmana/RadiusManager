#!/bin/bash
# Initialize database with all required tables
# This script creates tables directly without interactive prompts

set -e

echo "================================================"
echo "Database Initialization"
echo "================================================"
echo ""

# Check if we're in Docker or host
if [ -f "/.dockerenv" ]; then
    # Running inside Docker container
    echo "✓ Running inside Docker container"
    PSQL_CMD="psql -U \$PGUSER -d \$PGDATABASE"
else
    # Running on host - use docker compose exec
    echo "✓ Running on host - using docker compose"
    PSQL_CMD="docker compose exec -T postgres psql -U ispuser -d ispmanager"
fi

echo ""
echo "Creating application tables..."
echo ""

# Create session table (required for express-session)
echo "Creating session table..."
$PSQL_CMD << 'EOF'
CREATE TABLE IF NOT EXISTS session (
  sid varchar NOT NULL COLLATE "default",
  sess json NOT NULL,
  expire timestamp(6) NOT NULL,
  PRIMARY KEY (sid)
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);
EOF

echo "✓ Session table created"
echo ""
echo "Now running Drizzle migration (this may take a minute)..."
echo ""

# Use printf to answer prompts automatically
# Answer with option 1 (create new table) for all prompts
printf '1\n%.0s' {1..50} | npm run db:push 2>&1 | tee /tmp/db-push.log || {
    echo ""
    echo "⚠ Drizzle push had some prompts - checking results..."
}

# Verify tables were created
echo ""
echo "Verifying database setup..."
TABLE_COUNT=$($PSQL_CMD -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'" | tr -d ' ')

if [ "$TABLE_COUNT" -ge "10" ]; then
    echo "✓ Database initialized successfully ($TABLE_COUNT tables)"
    echo ""
    echo "Tables created:"
    $PSQL_CMD -c "\dt"
else
    echo "✗ Database initialization incomplete (only $TABLE_COUNT tables)"
    exit 1
fi
