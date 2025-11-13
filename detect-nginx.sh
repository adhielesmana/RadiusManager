#!/bin/bash

# Nginx Detection Script
# Detects nginx installations on host (non-Docker) and in Docker containers
# Returns status codes and exports variables for use by other scripts

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
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

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Global variables for detection results
NGINX_HOST_DETECTED=false
NGINX_HOST_RUNNING=false
NGINX_HOST_VERSION=""
NGINX_HOST_CONFIG_PATH=""
NGINX_HOST_PORTS=()

NGINX_DOCKER_DETECTED=false
NGINX_DOCKER_RUNNING=false
NGINX_DOCKER_CONTAINER=""
NGINX_DOCKER_PORTS=()
NGINX_DOCKER_NETWORK=""

NGINX_PORTS_IN_USE=()
RECOMMENDED_APP_PORT=""

# Detect nginx on host (non-Docker)
detect_host_nginx() {
    print_info "Checking for nginx on host system..."
    
    # Check if nginx binary exists
    if command -v nginx &> /dev/null; then
        NGINX_HOST_DETECTED=true
        NGINX_HOST_VERSION=$(nginx -v 2>&1 | grep -oP 'nginx/\K[0-9.]+')
        print_success "Nginx binary found on host (version: $NGINX_HOST_VERSION)"
        
        # Check if nginx is running
        if systemctl is-active --quiet nginx 2>/dev/null || pgrep -x nginx > /dev/null; then
            NGINX_HOST_RUNNING=true
            print_success "Nginx is running on host"
            
            # Detect nginx config path
            if [ -d "/etc/nginx/sites-available" ]; then
                NGINX_HOST_CONFIG_PATH="/etc/nginx/sites-available"
            elif [ -d "/etc/nginx/conf.d" ]; then
                NGINX_HOST_CONFIG_PATH="/etc/nginx/conf.d"
            fi
            
            # Detect ports nginx is listening on
            if command -v ss &> /dev/null; then
                # Use ss to detect listening ports
                NGINX_PORTS=$(ss -tlnp 2>/dev/null | grep nginx | grep -oP ':\K[0-9]+' | sort -u)
            elif command -v netstat &> /dev/null; then
                # Fallback to netstat
                NGINX_PORTS=$(netstat -tlnp 2>/dev/null | grep nginx | grep -oP ':\K[0-9]+' | sort -u)
            fi
            
            if [ -n "$NGINX_PORTS" ]; then
                while IFS= read -r port; do
                    NGINX_HOST_PORTS+=("$port")
                    NGINX_PORTS_IN_USE+=("$port")
                done <<< "$NGINX_PORTS"
                print_info "Nginx listening on ports: ${NGINX_HOST_PORTS[*]}"
            fi
        else
            print_info "Nginx is installed but not currently running"
        fi
    else
        print_info "No nginx installation found on host"
    fi
    
    echo ""
}

# Detect nginx in Docker containers
detect_docker_nginx() {
    print_info "Checking for nginx in Docker containers..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        print_info "Docker not available, skipping Docker nginx detection"
        echo ""
        return
    fi
    
    # Find running nginx containers
    NGINX_CONTAINERS=$(docker ps --filter "ancestor=nginx" --format "{{.Names}}" 2>/dev/null)
    
    if [ -z "$NGINX_CONTAINERS" ]; then
        # Also check for containers with nginx in the name
        NGINX_CONTAINERS=$(docker ps --filter "name=nginx" --format "{{.Names}}" 2>/dev/null)
    fi
    
    if [ -n "$NGINX_CONTAINERS" ]; then
        NGINX_DOCKER_DETECTED=true
        NGINX_DOCKER_RUNNING=true
        
        # Get first nginx container (in case there are multiple)
        NGINX_DOCKER_CONTAINER=$(echo "$NGINX_CONTAINERS" | head -n 1)
        print_success "Nginx container found: $NGINX_DOCKER_CONTAINER"
        
        # Get network
        NGINX_DOCKER_NETWORK=$(docker inspect "$NGINX_DOCKER_CONTAINER" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -n 1)
        if [ -n "$NGINX_DOCKER_NETWORK" ]; then
            print_info "Container network: $NGINX_DOCKER_NETWORK"
        fi
        
        # Get ports
        DOCKER_PORTS=$(docker port "$NGINX_DOCKER_CONTAINER" 2>/dev/null | grep -oP '0\.0\.0\.0:\K[0-9]+' | sort -u)
        if [ -n "$DOCKER_PORTS" ]; then
            while IFS= read -r port; do
                NGINX_DOCKER_PORTS+=("$port")
                NGINX_PORTS_IN_USE+=("$port")
            done <<< "$DOCKER_PORTS"
            print_info "Container exposed ports: ${NGINX_DOCKER_PORTS[*]}"
        fi
    else
        # Check for stopped nginx containers
        STOPPED_CONTAINERS=$(docker ps -a --filter "ancestor=nginx" --filter "status=exited" --format "{{.Names}}" 2>/dev/null)
        if [ -z "$STOPPED_CONTAINERS" ]; then
            STOPPED_CONTAINERS=$(docker ps -a --filter "name=nginx" --filter "status=exited" --format "{{.Names}}" 2>/dev/null)
        fi
        
        if [ -n "$STOPPED_CONTAINERS" ]; then
            NGINX_DOCKER_DETECTED=true
            NGINX_DOCKER_RUNNING=false
            NGINX_DOCKER_CONTAINER=$(echo "$STOPPED_CONTAINERS" | head -n 1)
            print_warning "Found stopped nginx container: $NGINX_DOCKER_CONTAINER"
        else
            print_info "No nginx containers found in Docker"
        fi
    fi
    
    echo ""
}

# Find available port for application
find_available_port() {
    print_info "Finding available port for application..."
    
    # Start from port 5000 and find first available
    for port in {5000..5100}; do
        # Check if port is in the detected nginx ports
        if [[ " ${NGINX_PORTS_IN_USE[@]} " =~ " ${port} " ]]; then
            continue
        fi
        
        # Check if port is available using ss or netstat
        if command -v ss &> /dev/null; then
            if ! ss -tln 2>/dev/null | grep -q ":$port "; then
                RECOMMENDED_APP_PORT=$port
                break
            fi
        elif command -v netstat &> /dev/null; then
            if ! netstat -tln 2>/dev/null | grep -q ":$port "; then
                RECOMMENDED_APP_PORT=$port
                break
            fi
        else
            # Fallback: assume port is available
            RECOMMENDED_APP_PORT=$port
            break
        fi
    done
    
    if [ -n "$RECOMMENDED_APP_PORT" ]; then
        print_success "Recommended application port: $RECOMMENDED_APP_PORT"
    else
        print_warning "Could not find available port, defaulting to 5000"
        RECOMMENDED_APP_PORT=5000
    fi
    
    echo ""
}

# Check if this is an update or fresh install
check_deployment_type() {
    print_info "Checking deployment type..."
    
    # Check if .env exists and has been configured
    if [ -f .env ]; then
        # Check if key variables are set
        if grep -q "^APP_DOMAIN=" .env && grep -q "^APP_PORT=" .env; then
            # Check if containers from this project exist
            if docker ps -a --filter "label=com.docker.compose.project" --format "{{.Names}}" 2>/dev/null | grep -q "isp-manager"; then
                export DEPLOYMENT_TYPE="update"
                print_success "Detected: Update deployment (existing configuration found)"
            else
                export DEPLOYMENT_TYPE="fresh"
                print_warning "Detected: Fresh installation (configuration exists but no containers)"
            fi
        else
            export DEPLOYMENT_TYPE="fresh"
            print_info "Detected: Fresh installation (incomplete configuration)"
        fi
    else
        export DEPLOYMENT_TYPE="fresh"
        print_info "Detected: Fresh installation (no configuration file)"
    fi
    
    echo ""
}

# Export detection results
export_results() {
    export NGINX_HOST_DETECTED
    export NGINX_HOST_RUNNING
    export NGINX_HOST_VERSION
    export NGINX_HOST_CONFIG_PATH
    export NGINX_HOST_PORTS
    
    export NGINX_DOCKER_DETECTED
    export NGINX_DOCKER_RUNNING
    export NGINX_DOCKER_CONTAINER
    export NGINX_DOCKER_PORTS
    export NGINX_DOCKER_NETWORK
    
    export NGINX_PORTS_IN_USE
    export RECOMMENDED_APP_PORT
}

# Display detection summary
display_summary() {
    print_header "Nginx Detection Summary"
    
    echo "Host Nginx:"
    if [ "$NGINX_HOST_DETECTED" = true ]; then
        echo "  ✓ Detected: Yes (version $NGINX_HOST_VERSION)"
        echo "  ✓ Running: $([ "$NGINX_HOST_RUNNING" = true ] && echo "Yes" || echo "No")"
        if [ ${#NGINX_HOST_PORTS[@]} -gt 0 ]; then
            echo "  ✓ Ports: ${NGINX_HOST_PORTS[*]}"
        fi
        if [ -n "$NGINX_HOST_CONFIG_PATH" ]; then
            echo "  ✓ Config: $NGINX_HOST_CONFIG_PATH"
        fi
    else
        echo "  ✗ Not detected"
    fi
    
    echo ""
    echo "Docker Nginx:"
    if [ "$NGINX_DOCKER_DETECTED" = true ]; then
        echo "  ✓ Detected: Yes"
        echo "  ✓ Running: $([ "$NGINX_DOCKER_RUNNING" = true ] && echo "Yes" || echo "No")"
        if [ -n "$NGINX_DOCKER_CONTAINER" ]; then
            echo "  ✓ Container: $NGINX_DOCKER_CONTAINER"
        fi
        if [ ${#NGINX_DOCKER_PORTS[@]} -gt 0 ]; then
            echo "  ✓ Ports: ${NGINX_DOCKER_PORTS[*]}"
        fi
        if [ -n "$NGINX_DOCKER_NETWORK" ]; then
            echo "  ✓ Network: $NGINX_DOCKER_NETWORK"
        fi
    else
        echo "  ✗ Not detected"
    fi
    
    echo ""
    echo "Deployment Information:"
    echo "  ✓ Type: ${DEPLOYMENT_TYPE:-unknown}"
    if [ -n "$RECOMMENDED_APP_PORT" ]; then
        echo "  ✓ Recommended Port: $RECOMMENDED_APP_PORT"
    fi
    
    echo ""
}

# Main detection routine
run_nginx_detection() {
    if [ "${1:-}" = "--silent" ]; then
        # Silent mode: suppress output
        detect_host_nginx > /dev/null 2>&1
        detect_docker_nginx > /dev/null 2>&1
        find_available_port > /dev/null 2>&1
        check_deployment_type > /dev/null 2>&1
    else
        print_header "Nginx Detection"
        detect_host_nginx
        detect_docker_nginx
        find_available_port
        check_deployment_type
        display_summary
    fi
    
    export_results
    
    # Return status code based on what was detected
    # 0 = No nginx detected
    # 1 = Host nginx detected
    # 2 = Docker nginx detected
    # 3 = Both detected
    
    if [ "$NGINX_HOST_DETECTED" = true ] && [ "$NGINX_DOCKER_DETECTED" = true ]; then
        return 3
    elif [ "$NGINX_HOST_DETECTED" = true ]; then
        return 1
    elif [ "$NGINX_DOCKER_DETECTED" = true ]; then
        return 2
    else
        return 0
    fi
}

# Run if executed directly
if [ "${BASH_SOURCE[0]}" -ef "$0" ]; then
    run_nginx_detection "$@"
    exit $?
fi
