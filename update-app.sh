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
print_header "Database Schema Validation"

# Wait for container to be ready
print_info "Waiting for container to be ready..."
sleep 5

# Check schema with dry-run to detect differences
print_info "Checking if database schema matches application..."

if timeout 30 docker compose -f docker-compose.yml exec -T app npm run db:push -- --dry-run > /tmp/db-check.log 2>&1; then
    # Check if schema is in sync
    if grep -q "Everything is in sync" /tmp/db-check.log; then
        print_success "Database schema is up to date"
        print_info "No migration needed"
        rm -f /tmp/db-check.log
    else
        # Schema differences detected
        print_info "Schema differences detected - running migration..."
        echo -n "Progress: "
        
        # Run actual migration with progress indicator
        (timeout 60 docker compose -f docker-compose.yml exec -T app npm run db:push -- --force > /tmp/db-migration.log 2>&1) &
        MIGRATION_PID=$!
        
        # Show progress dots
        while kill -0 $MIGRATION_PID 2>/dev/null; do
            echo -n "."
            sleep 2
        done
        echo ""
        
        wait $MIGRATION_PID
        MIGRATION_EXIT=$?
        
        if [ $MIGRATION_EXIT -eq 0 ]; then
            print_success "Database schema synchronized successfully"
        else
            print_error "Migration failed - check logs: docker compose logs app"
            cat /tmp/db-migration.log
            rm -f /tmp/db-migration.log /tmp/db-check.log
            exit 1
        fi
        
        rm -f /tmp/db-migration.log
    fi
else
    # Dry-run failed - connection issue or schema problem
    print_error "Failed to check database schema"
    print_info "This could be a connection issue or schema problem"
    cat /tmp/db-check.log
    rm -f /tmp/db-check.log
    exit 1
fi

rm -f /tmp/db-check.log

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
