#!/bin/bash

# Automatic Port Adjustment Script
# Adjusts APP_PORT in .env to avoid conflicts with detected nginx

# Source detection script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/detect-nginx.sh"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Update APP_PORT in .env file
update_app_port() {
    local new_port=$1
    local env_file=".env"
    
    if [ ! -f "$env_file" ]; then
        print_error ".env file not found"
        return 1
    fi
    
    # Check if APP_PORT exists in .env
    if grep -q "^APP_PORT=" "$env_file"; then
        # Get current port
        local current_port=$(grep "^APP_PORT=" "$env_file" | cut -d'=' -f2)
        
        if [ "$current_port" = "$new_port" ]; then
            print_info "APP_PORT already set to $new_port"
            return 0
        fi
        
        # Update existing APP_PORT
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/^APP_PORT=.*/APP_PORT=$new_port/" "$env_file"
        else
            # Linux
            sed -i "s/^APP_PORT=.*/APP_PORT=$new_port/" "$env_file"
        fi
        
        print_success "Updated APP_PORT from $current_port to $new_port"
    else
        # Add APP_PORT if it doesn't exist
        echo "APP_PORT=$new_port" >> "$env_file"
        print_success "Added APP_PORT=$new_port to .env"
    fi
    
    return 0
}

# Main function
main() {
    # Run detection in silent mode
    run_nginx_detection --silent
    local detection_result=$?
    
    # Check if port adjustment is needed
    if [ -z "$RECOMMENDED_APP_PORT" ]; then
        print_error "Could not determine recommended port"
        return 1
    fi
    
    # If host nginx is detected and running, ensure we use a different port
    if [ "$NGINX_HOST_DETECTED" = true ] && [ "$NGINX_HOST_RUNNING" = true ]; then
        print_info "Host nginx detected on ports: ${NGINX_HOST_PORTS[*]}"
        print_info "Adjusting application port to avoid conflicts..."
        echo ""
        
        update_app_port "$RECOMMENDED_APP_PORT"
        
        echo ""
        print_success "Port configuration updated successfully"
        print_info "Application will run on port: $RECOMMENDED_APP_PORT"
        print_info "Host nginx will proxy to this port"
        
        return 0
    fi
    
    # If Docker nginx detected, also adjust port
    if [ "$NGINX_DOCKER_DETECTED" = true ] && [ "$NGINX_DOCKER_RUNNING" = true ]; then
        print_info "Docker nginx detected on ports: ${NGINX_DOCKER_PORTS[*]}"
        print_info "Adjusting application port to avoid conflicts..."
        echo ""
        
        update_app_port "$RECOMMENDED_APP_PORT"
        
        echo ""
        print_success "Port configuration updated successfully"
        print_info "Application will run on port: $RECOMMENDED_APP_PORT"
        
        return 0
    fi
    
    # No conflicts detected
    print_info "No port conflicts detected"
    
    # Still set recommended port if not set
    if [ ! -f .env ] || ! grep -q "^APP_PORT=" .env; then
        print_info "Setting default application port..."
        update_app_port "${RECOMMENDED_APP_PORT:-5000}"
    fi
    
    return 0
}

# Run main if executed directly
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
    main "$@"
    exit $?
fi
