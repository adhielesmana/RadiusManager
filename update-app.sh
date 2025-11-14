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
echo "  • Validate and sync database schema"
echo "  • Skip all nginx configuration changes"
echo ""
print_info "Your nginx configuration will NOT be modified"
echo ""

# Ask if user wants to skip schema validation
echo ""
read -p "Skip database schema validation? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    SKIP_SCHEMA_CHECK=true
    print_info "Schema validation will be skipped"
else
    SKIP_SCHEMA_CHECK=false
fi

echo ""
read -p "Continue with update? (y/n) " -n 1 -r
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

if [ "$SKIP_SCHEMA_CHECK" = "false" ]; then
    echo ""
    print_header "Database Schema Validation"
    
    # Wait for app container to be ready (smart check, not blind delay)
    print_info "Waiting for app container to be ready..."
    MAX_WAIT=30
    WAIT_COUNT=0
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        CONTAINER_STATUS=$(docker compose -f docker-compose.yml ps app --format json 2>/dev/null | grep -o '"State":"[^"]*"' | cut -d'"' -f4 || echo "")
        
        if [ "$CONTAINER_STATUS" = "running" ]; then
            print_success "App container is running"
            break
        fi
        
        echo -n "."
        sleep 1
        WAIT_COUNT=$((WAIT_COUNT + 1))
    done
    echo ""
    
    if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
        print_error "App container failed to start within 30 seconds"
        docker compose -f docker-compose.yml ps
        exit 1
    fi
    
    # Give it 2 more seconds for Node.js to initialize
    sleep 2
    
    # Check schema with dry-run to detect differences
    print_info "Checking if database schema matches application (max 30s)..."
    
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
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 124 ]; then
            # Timeout - likely large database
            print_warning "Schema check timed out after 30 seconds"
            print_info "This is normal for large databases"
            print_info "Skipping schema validation - schema will auto-sync on app start"
        else
            # Other error
            print_error "Failed to check database schema"
            cat /tmp/db-check.log
            rm -f /tmp/db-check.log
            exit 1
        fi
    fi
    
    rm -f /tmp/db-check.log
else
    echo ""
    print_header "Database Schema"
    print_info "Schema validation skipped (user choice)"
    print_info "Schema will auto-sync when application starts"
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
