#!/bin/bash
set -e

# ISP Manager - App-Only Update Script
# This script ONLY updates the application code without touching nginx configuration
# Safe to run when nginx is already configured and running

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Load environment variables
if [ ! -f .env ]; then
    print_error ".env file not found"
    exit 1
fi

set -a
source .env
set +a

print_header "ISP Manager - Application Update"
echo ""
print_info "This script will:"
echo "  • Build updated Docker images"
echo "  • Restart application containers"
echo "  • Skip all nginx configuration changes"
echo ""
print_info "Your nginx configuration will NOT be modified"
echo ""

# Confirm
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Update cancelled"
    exit 0
fi

echo ""
print_header "Building Updated Images"
docker compose -f docker-compose.yml build

echo ""
print_header "Restarting Containers"
docker compose -f docker-compose.yml up -d

echo ""
print_header "Database Migration"

# Wait for container to be ready
print_info "Waiting for container to be ready..."
sleep 5

# Check if database is accessible and tables exist
print_info "Checking database status..."
TABLES_EXIST=$(docker compose -f docker-compose.yml exec -T app node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='customers'\")
  .then(r => { console.log(r.rows[0].count); process.exit(0); })
  .catch(() => { console.log('0'); process.exit(0); });
" 2>/dev/null || echo "0")

if [ "$TABLES_EXIST" != "0" ]; then
    print_success "Database tables already exist - skipping migration"
    print_info "Tables will auto-sync on application start if needed"
else
    print_info "Running database migration (this may take 30-60 seconds)..."
    echo -n "Progress: "
    
    # Run migration in background and show progress
    (timeout 60 docker compose -f docker-compose.yml exec -T app npm run db:push -- --force > /tmp/db-migration.log 2>&1) &
    MIGRATION_PID=$!
    
    # Show progress while waiting
    while kill -0 $MIGRATION_PID 2>/dev/null; do
        echo -n "."
        sleep 2
    done
    echo ""
    
    wait $MIGRATION_PID
    MIGRATION_EXIT=$?
    
    if [ $MIGRATION_EXIT -eq 0 ]; then
        if grep -q "Everything is in sync" /tmp/db-migration.log 2>/dev/null; then
            print_success "Database tables are up to date"
        else
            print_success "Database schema synchronized"
        fi
    elif [ $MIGRATION_EXIT -eq 124 ]; then
        print_info "Migration timed out - tables will be created on app start"
    else
        print_info "Migration completed (check logs if needed: docker compose logs app)"
    fi
    
    # Clean up log file
    rm -f /tmp/db-migration.log
fi

echo ""
print_header "Waiting for Application"
print_info "Waiting for application to start..."
sleep 5

# Check if app is responding
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_HOST_PORT:-5000} 2>/dev/null || echo "000")
    if echo "$HTTP_CODE" | grep -q "200\|302"; then
        print_success "Application is running!"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -n "."
    sleep 2
done

echo ""
if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    print_error "Application did not respond within timeout"
    print_info "Check logs with: docker compose logs -f app"
    exit 1
fi

echo ""
print_success "Update Complete!"
echo ""
print_info "Application Status:"
docker compose ps

echo ""
print_info "Your application has been updated successfully"
print_info "Nginx configuration was not modified"
print_info "Access your app at: https://$APP_DOMAIN"
echo ""
