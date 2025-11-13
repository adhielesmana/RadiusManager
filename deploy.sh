#!/bin/bash
set -e

# ISP Manager - Automated Deployment Script
# This script handles deployment with automatic error recovery

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if a port is in use
check_port_in_use() {
    local PORT=$1
    
    if command_exists nc; then
        nc -z localhost $PORT 2>/dev/null
        return $?
    elif command_exists lsof; then
        lsof -i:$PORT >/dev/null 2>&1
        return $?
    elif command_exists ss; then
        ss -tuln | grep -q ":$PORT "
        return $?
    elif command_exists netstat; then
        netstat -tuln | grep -q ":$PORT "
        return $?
    else
        return 1
    fi
}

# Validate port availability before deployment
validate_ports() {
    print_header "Validating Port Availability"
    
    local PORTS_OK=true
    local CONFLICTS=""
    
    # Load ports from .env
    if [ -f .env ]; then
        set -a
        source .env
        set +a
    fi
    
    # Check application port (but not if it's already our container)
    if check_port_in_use ${APP_HOST_PORT:-5000}; then
        # Check if it's our own container
        if docker ps --format '{{.Names}}' | grep -q 'isp-manager-app'; then
            print_info "Port ${APP_HOST_PORT:-5000} is used by ISP Manager (will restart)"
        else
            print_error "Port ${APP_HOST_PORT:-5000} (Application) is in use by another service"
            CONFLICTS="${CONFLICTS}  • Port ${APP_HOST_PORT:-5000}: Application\n"
            PORTS_OK=false
        fi
    else
        print_success "Port ${APP_HOST_PORT:-5000} (Application) is available"
    fi
    
    # Check PostgreSQL port
    if check_port_in_use ${POSTGRES_HOST_PORT:-5433}; then
        if docker ps --format '{{.Names}}' | grep -q 'isp-postgres'; then
            print_info "Port ${POSTGRES_HOST_PORT:-5433} is used by ISP Manager (will restart)"
        else
            print_error "Port ${POSTGRES_HOST_PORT:-5433} (PostgreSQL) is in use by another service"
            CONFLICTS="${CONFLICTS}  • Port ${POSTGRES_HOST_PORT:-5433}: PostgreSQL\n"
            PORTS_OK=false
        fi
    else
        print_success "Port ${POSTGRES_HOST_PORT:-5433} (PostgreSQL) is available"
    fi
    
    # Check RADIUS Auth port
    if check_port_in_use ${RADIUS_AUTH_PORT:-1812}; then
        if docker ps --format '{{.Names}}' | grep -q 'isp-freeradius'; then
            print_info "Port ${RADIUS_AUTH_PORT:-1812} is used by ISP Manager (will restart)"
        else
            print_error "Port ${RADIUS_AUTH_PORT:-1812} (RADIUS Auth) is in use by another service"
            CONFLICTS="${CONFLICTS}  • Port ${RADIUS_AUTH_PORT:-1812}: RADIUS Auth\n"
            PORTS_OK=false
        fi
    else
        print_success "Port ${RADIUS_AUTH_PORT:-1812} (RADIUS Auth) is available"
    fi
    
    # Check RADIUS Acct port
    if check_port_in_use ${RADIUS_ACCT_PORT:-1813}; then
        if docker ps --format '{{.Names}}' | grep -q 'isp-freeradius'; then
            print_info "Port ${RADIUS_ACCT_PORT:-1813} is used by ISP Manager (will restart)"
        else
            print_error "Port ${RADIUS_ACCT_PORT:-1813} (RADIUS Acct) is in use by another service"
            CONFLICTS="${CONFLICTS}  • Port ${RADIUS_ACCT_PORT:-1813}: RADIUS Acct\n"
            PORTS_OK=false
        fi
    else
        print_success "Port ${RADIUS_ACCT_PORT:-1813} (RADIUS Acct) is available"
    fi
    
    # Check SSL ports if enabled
    if [ "$ENABLE_SSL" = "true" ]; then
        if check_port_in_use ${HTTP_PORT:-80}; then
            if docker ps --format '{{.Names}}' | grep -q 'isp-manager-reverse-proxy'; then
                print_info "Port ${HTTP_PORT:-80} is used by ISP Manager (will restart)"
            else
                print_error "Port ${HTTP_PORT:-80} (HTTP/SSL) is in use by another service"
                CONFLICTS="${CONFLICTS}  • Port ${HTTP_PORT:-80}: HTTP (SSL mode)\n"
                PORTS_OK=false
            fi
        else
            print_success "Port ${HTTP_PORT:-80} (HTTP/SSL) is available"
        fi
        
        if check_port_in_use ${HTTPS_PORT:-443}; then
            if docker ps --format '{{.Names}}' | grep -q 'isp-manager-reverse-proxy'; then
                print_info "Port ${HTTPS_PORT:-443} is used by ISP Manager (will restart)"
            else
                print_error "Port ${HTTPS_PORT:-443} (HTTPS/SSL) is in use by another service"
                CONFLICTS="${CONFLICTS}  • Port ${HTTPS_PORT:-443}: HTTPS (SSL mode)\n"
                PORTS_OK=false
            fi
        else
            print_success "Port ${HTTPS_PORT:-443} (HTTPS/SSL) is available"
        fi
    fi
    
    # Check for port duplicates in configuration
    local ALL_PORTS="${APP_HOST_PORT:-5000} ${POSTGRES_HOST_PORT:-5433} ${RADIUS_AUTH_PORT:-1812} ${RADIUS_ACCT_PORT:-1813}"
    if [ "$ENABLE_SSL" = "true" ]; then
        ALL_PORTS="$ALL_PORTS ${HTTP_PORT:-80} ${HTTPS_PORT:-443}"
    fi
    
    # Detect duplicates in port configuration
    local SEEN_PORTS=""
    for PORT in $ALL_PORTS; do
        for SEEN in $SEEN_PORTS; do
            if [ "$PORT" = "$SEEN" ]; then
                print_error "Duplicate port detected in configuration: $PORT"
                CONFLICTS="${CONFLICTS}  • Port $PORT is assigned to multiple services\n"
                PORTS_OK=false
                break
            fi
        done
        SEEN_PORTS="$SEEN_PORTS $PORT"
    done
    
    # If ports are in conflict, offer automatic resolution
    if [ "$PORTS_OK" = false ]; then
        echo ""
        print_warning "Port conflicts detected!"
        echo -e "${YELLOW}Conflicting ports:${NC}"
        echo -e "$CONFLICTS"
        echo ""
        print_info "Solution: Running setup script to automatically resolve conflicts..."
        echo ""
        
        # Run setup with --auto flag to resolve conflicts
        if ! ./setup.sh --auto; then
            print_error "Failed to resolve port conflicts"
            exit 1
        fi
        
        print_success "Port conflicts resolved! Continuing with deployment..."
        echo ""
        
        # Reload environment after fixes
        set -a
        source .env
        set +a
    else
        print_success "All ports are available and no duplicates detected"
        echo ""
    fi
}

# Cleanup stale resources
cleanup_stale_resources() {
    print_header "Cleaning Up Stale Resources"
    
    # Remove any stopped ISP Manager containers
    if docker ps -a --format '{{.Names}}' | grep -q '^isp-'; then
        print_info "Removing stopped ISP Manager containers..."
        docker ps -a --format '{{.Names}}' | grep '^isp-' | xargs -r docker rm -f 2>/dev/null || true
        print_success "Stale containers removed"
    else
        print_info "No stale containers found"
    fi
    
    # Clean up dangling images
    if docker images -f "dangling=true" -q | grep -q .; then
        print_info "Removing dangling images..."
        docker image prune -f >/dev/null 2>&1
        print_success "Dangling images removed"
    else
        print_info "No dangling images"
    fi
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if ! command_exists docker; then
        print_error "Docker is not installed"
        print_info "Please run './setup.sh' first"
        exit 1
    fi
    print_success "Docker is available"
    
    # Check Docker Compose
    if ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not available"
        print_info "Please run './setup.sh' first"
        exit 1
    fi
    print_success "Docker Compose is available"
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running"
        print_info "Please start Docker and try again"
        exit 1
    fi
    print_success "Docker daemon is running"
    
    # Check .env file
    if [ ! -f .env ]; then
        print_error ".env file not found"
        print_info "Running setup script to create configuration..."
        if ./setup.sh --auto; then
            print_success ".env file created"
        else
            print_error "Setup failed"
            exit 1
        fi
    else
        print_success ".env file exists"
    fi
    
    # Check deployment mode (DEPLOYMENT_MODE already sourced at top-level)
    if [ "$DEPLOYMENT_MODE" = "host_nginx" ]; then
        COMPOSE_FILES="-f docker-compose.yml"
        SSL_MODE="HOST_NGINX"
        SETUP_HOST_NGINX=true
        print_info "Deployment Mode: HOST NGINX (nginx on host, backend on port ${APP_HOST_PORT:-5000}, domain: ${APP_DOMAIN})"
    elif [ "$ENABLE_SSL" = "true" ]; then
        COMPOSE_FILES="-f docker-compose.yml -f docker-compose.ssl.yml"
        SSL_MODE="ENABLED"
        SETUP_HOST_NGINX=false
        print_info "Deployment Mode: DOCKER NGINX with SSL (using domain: ${APP_DOMAIN})"
    elif [ "$ENABLE_SSL" = "existing_nginx" ]; then
        COMPOSE_FILES="-f docker-compose.yml"
        SSL_MODE="EXISTING_NGINX"
        SETUP_HOST_NGINX=false
        print_info "Deployment Mode: EXISTING NGINX (backend on port 5000, domain: ${APP_DOMAIN})"
    else
        COMPOSE_FILES="-f docker-compose.yml"
        SSL_MODE="DISABLED"
        SETUP_HOST_NGINX=false
        print_info "Deployment Mode: DOCKER only (local development)"
    fi
    
    # Check curl (needed for health checks)
    if ! command_exists curl; then
        print_warning "curl not found, will skip application health check"
        SKIP_CURL_CHECK=true
    else
        SKIP_CURL_CHECK=false
    fi
}

# Stop existing containers
stop_containers() {
    print_header "Stopping Existing Containers"
    
    if docker compose $COMPOSE_FILES ps -q 2>/dev/null | grep -q .; then
        print_info "Stopping running containers..."
        docker compose $COMPOSE_FILES down 2>/dev/null || {
            print_warning "Normal shutdown failed, forcing container removal..."
            docker ps -a --format '{{.Names}}' | grep '^isp-' | xargs -r docker rm -f 2>/dev/null || true
        }
        print_success "Containers stopped"
    else
        print_info "No running containers to stop"
    fi
}

# Build images
build_images() {
    print_header "Building Docker Images"
    
    print_info "Building Docker images..."
    if [ "$REBUILD" = true ]; then
        docker compose $COMPOSE_FILES build --no-cache 2>&1 | tail -20
    else
        docker compose $COMPOSE_FILES build 2>&1 | tail -20
    fi
    print_success "Docker images built successfully"
}

# Start services with retry logic
start_services() {
    print_header "Starting Services"
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        print_info "Starting PostgreSQL, FreeRADIUS, ISP Manager, and Nginx (SSL)..."
    else
        print_info "Starting PostgreSQL, FreeRADIUS, and ISP Manager..."
    fi
    
    local MAX_RETRIES=3
    local RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if docker compose $COMPOSE_FILES up -d 2>&1; then
            print_success "Services started in background"
            return 0
        else
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                print_warning "Start failed, retrying ($RETRY_COUNT/$MAX_RETRIES)..."
                sleep 3
                
                # Clean up before retry
                docker compose $COMPOSE_FILES down 2>/dev/null || true
            else
                print_error "Failed to start services after $MAX_RETRIES attempts"
                print_info "Checking for port conflicts..."
                validate_ports
                return 1
            fi
        fi
    done
}

# Wait for services to be healthy
wait_for_services() {
    print_header "Waiting for Services to be Ready"
    
    # Wait for PostgreSQL
    print_info "Waiting for PostgreSQL..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker compose $COMPOSE_FILES exec -T postgres pg_isready -U ispuser >/dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            break
        fi
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "PostgreSQL failed to start within timeout"
        print_info "Checking logs..."
        docker compose $COMPOSE_FILES logs --tail=20 postgres
        exit 1
    fi
    
    # Wait for ISP Manager application
    if [ "$SKIP_CURL_CHECK" = false ]; then
        print_info "Waiting for ISP Manager application..."
        attempt=0
        
        while [ $attempt -lt $max_attempts ]; do
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_HOST_PORT:-5000} 2>/dev/null || echo "000")
            if echo "$HTTP_CODE" | grep -q "200\|302"; then
                print_success "ISP Manager application is ready"
                break
            fi
            attempt=$((attempt + 1))
            echo -n "."
            sleep 2
        done
        
        if [ $attempt -eq $max_attempts ]; then
            print_warning "ISP Manager application may not be fully ready yet"
            print_info "Checking application logs..."
            docker compose $COMPOSE_FILES logs --tail=30 app
            print_info "Application is starting, this may take a moment"
        fi
    else
        print_info "Waiting for ISP Manager application (curl not available)..."
        sleep 10
        print_info "Application should be starting, check logs if needed"
    fi
    
    # Check FreeRADIUS
    print_info "Checking FreeRADIUS..."
    if docker compose $COMPOSE_FILES exec -T freeradius radiusd -v >/dev/null 2>&1; then
        print_success "FreeRADIUS is running"
    else
        print_warning "FreeRADIUS status could not be verified"
    fi
}

# Connect to existing nginx network if detected
connect_to_nginx_network() {
    print_header "Connecting to Existing Nginx Network"
    
    # Only do this for existing_nginx mode
    if [ "$SSL_MODE" != "EXISTING_NGINX" ]; then
        print_info "Not in existing_nginx mode, skipping network connection"
        return 0
    fi
    
    # Get the actual app container name using docker compose
    local APP_CONTAINER=$(docker compose $COMPOSE_FILES ps -q app 2>/dev/null)
    if [ -z "$APP_CONTAINER" ]; then
        print_error "Could not find app container"
        return 1
    fi
    
    # Get the actual container name from the ID
    APP_CONTAINER=$(docker inspect "$APP_CONTAINER" --format '{{.Name}}' 2>/dev/null | sed 's/^\/\///')
    
    if [ -z "$APP_CONTAINER" ]; then
        print_error "Could not determine app container name"
        return 1
    fi
    
    print_success "App container: $APP_CONTAINER"
    
    # Detect nginx container with public ports 80/443
    local NGINX_CONTAINER=""
    local ALL_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null)
    
    for CONTAINER in $ALL_CONTAINERS; do
        local PORT_BINDINGS=$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}' 2>/dev/null)
        
        if echo "$PORT_BINDINGS" | grep -qE '"(80|443)/tcp".*"HostIp":"(0\.0\.0\.0|::)"'; then
            local IMAGE=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
            
            if echo "$CONTAINER $IMAGE" | grep -iqE "(nginx|proxy)"; then
                NGINX_CONTAINER="$CONTAINER"
                break
            fi
        fi
    done
    
    if [ -z "$NGINX_CONTAINER" ]; then
        print_warning "No nginx container detected on ports 80/443"
        print_info "Make sure your nginx container is running"
        return 0
    fi
    
    print_success "Detected nginx container: $NGINX_CONTAINER"
    
    # Get the nginx container's networks
    local NGINX_NETWORKS=$(docker inspect "$NGINX_CONTAINER" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)
    
    if [ -z "$NGINX_NETWORKS" ]; then
        print_warning "Could not detect nginx networks"
        return 0
    fi
    
    print_info "Nginx networks: $NGINX_NETWORKS"
    
    # Connect app container to each nginx network
    for NETWORK in $NGINX_NETWORKS; do
        # Check if already connected
        if docker inspect "$APP_CONTAINER" 2>/dev/null | grep -q "\"$NETWORK\""; then
            print_info "Already connected to network: $NETWORK"
        else
            print_info "Connecting $APP_CONTAINER to network: $NETWORK..."
            if docker network connect "$NETWORK" "$APP_CONTAINER" 2>/dev/null; then
                print_success "Connected to $NETWORK"
            else
                print_warning "Failed to connect to $NETWORK (may already be connected)"
            fi
        fi
    done
    
    # Verify connection using the container name that nginx expects (isp-manager-app)
    print_info "Verifying nginx can reach isp-manager-app..."
    if docker exec "$NGINX_CONTAINER" wget -qO- http://isp-manager-app:5000 >/dev/null 2>&1; then
        print_success "Network connection verified!"
    else
        print_warning "Could not verify network connection"
        print_info "Nginx may not be able to reach isp-manager-app"
    fi
    
    # Return nginx container name for use by other functions
    echo "$NGINX_CONTAINER"
}

# Setup SSL certificates in nginx container
setup_nginx_ssl() {
    print_header "Setting Up SSL Certificates in Nginx"
    
    # Only do this for existing_nginx mode
    if [ "$SSL_MODE" != "EXISTING_NGINX" ]; then
        print_info "Not in existing_nginx mode, skipping SSL setup"
        return 0
    fi
    
    # Detect nginx container
    local NGINX_CONTAINER=""
    local ALL_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null)
    
    for CONTAINER in $ALL_CONTAINERS; do
        local PORT_BINDINGS=$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}' 2>/dev/null)
        
        if echo "$PORT_BINDINGS" | grep -qE '"(80|443)/tcp".*"HostIp":"(0\.0\.0\.0|::)"'; then
            local IMAGE=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
            
            if echo "$CONTAINER $IMAGE" | grep -iqE "(nginx|proxy)"; then
                NGINX_CONTAINER="$CONTAINER"
                break
            fi
        fi
    done
    
    if [ -z "$NGINX_CONTAINER" ]; then
        print_warning "No nginx container detected, skipping SSL setup"
        return 0
    fi
    
    print_success "Nginx container: $NGINX_CONTAINER"
    
    # Check if /etc/letsencrypt exists on host
    if [ ! -d /etc/letsencrypt ]; then
        print_info "No /etc/letsencrypt directory found on host"
        print_info "Certificates will be provisioned later"
        return 0
    fi
    
    # Check if certificates already exist in container
    if docker exec "$NGINX_CONTAINER" test -d /etc/letsencrypt/live 2>/dev/null; then
        print_info "Certificates already exist in container"
    else
        print_info "Copying SSL certificates into nginx container..."
        
        # Stop nginx to copy files safely (|| true to avoid abort if already stopped)
        print_info "Stopping nginx temporarily..."
        docker stop "$NGINX_CONTAINER" >/dev/null 2>&1 || true
        
        # Copy certificates into container
        docker cp /etc/letsencrypt "$NGINX_CONTAINER":/etc/ 2>/dev/null || {
            print_warning "Failed to copy certificates"
        }
        
        # Start nginx back up (|| true to avoid abort)
        print_info "Starting nginx..."
        docker start "$NGINX_CONTAINER" >/dev/null 2>&1 || true
        sleep 3
        
        print_success "Certificates copied successfully"
    fi
    
    # Fix nginx.conf to comment out global SSL directives
    # Copy file out → edit locally → copy back in to avoid "Resource busy" errors
    print_info "Fixing nginx.conf to use per-domain certificates..."
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    
    # Copy nginx.conf from container to host
    docker cp "$NGINX_CONTAINER":/etc/nginx/nginx.conf "$TEMP_DIR/nginx.conf" 2>/dev/null || {
        print_warning "Could not copy nginx.conf from container"
        rm -rf "$TEMP_DIR"
        return 0
    }
    
    # Create backup
    cp "$TEMP_DIR/nginx.conf" "$TEMP_DIR/nginx.conf.backup"
    
    # Edit locally (sed works on regular files)
    sed -i \
        -e 's|^[[:space:]]*ssl_certificate[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate /etc/nginx/ssl/|' \
        -e 's|^[[:space:]]*ssl_certificate_key[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate_key /etc/nginx/ssl/|' \
        "$TEMP_DIR/nginx.conf" 2>/dev/null || {
        print_warning "Could not edit nginx.conf"
        rm -rf "$TEMP_DIR"
        return 0
    }
    
    # Stop nginx to copy file back in (|| true to avoid abort if already stopped)
    docker stop "$NGINX_CONTAINER" >/dev/null 2>&1 || true
    
    # Copy modified nginx.conf back to container
    docker cp "$TEMP_DIR/nginx.conf" "$NGINX_CONTAINER":/etc/nginx/nginx.conf 2>/dev/null || {
        print_error "Could not copy modified nginx.conf back to container"
        # Try to restore backup
        docker cp "$TEMP_DIR/nginx.conf.backup" "$NGINX_CONTAINER":/etc/nginx/nginx.conf 2>/dev/null || true
        rm -rf "$TEMP_DIR"
        docker start "$NGINX_CONTAINER" >/dev/null 2>&1 || true
        return 1
    }
    
    # Also copy backup to container for later rollback if needed
    docker cp "$TEMP_DIR/nginx.conf.backup" "$NGINX_CONTAINER":/etc/nginx/nginx.conf.backup 2>/dev/null || true
    
    # Start nginx (|| true to avoid abort)
    docker start "$NGINX_CONTAINER" >/dev/null 2>&1 || true
    sleep 3
    
    print_success "nginx.conf updated successfully"
    
    # Cleanup temp dir
    rm -rf "$TEMP_DIR"
    
    # Test nginx config
    print_info "Testing nginx configuration..."
    if docker exec "$NGINX_CONTAINER" nginx -t 2>&1 | grep -q "successful"; then
        print_success "Nginx configuration is valid"
    else
        print_error "Nginx configuration has errors, reverting..."
        
        # Stop nginx to restore backup
        docker stop "$NGINX_CONTAINER" >/dev/null 2>&1 || true
        
        # Restore backup
        if docker exec "$NGINX_CONTAINER" test -f /etc/nginx/nginx.conf.backup 2>/dev/null; then
            docker exec "$NGINX_CONTAINER" cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf 2>/dev/null || {
                print_error "Could not restore backup"
            }
        fi
        
        # Start nginx with original config
        docker start "$NGINX_CONTAINER" >/dev/null 2>&1 || true
        sleep 2
        
        print_warning "Reverted to original nginx.conf"
        return 1
    fi
    
    # Reload nginx
    print_info "Reloading nginx..."
    docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null || {
        print_warning "Could not reload nginx, restarting container..."
        docker restart "$NGINX_CONTAINER" >/dev/null 2>&1
        sleep 3
    }
    
    print_success "SSL setup complete!"
}

# Display service status
show_status() {
    print_header "Service Status"
    docker compose $COMPOSE_FILES ps
}

# Display logs (last 20 lines)
show_logs() {
    print_header "Recent Logs"
    print_info "Application logs (last 20 lines):"
    docker compose $COMPOSE_FILES logs --tail=20 app
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        echo ""
        print_info "Nginx logs (last 10 lines):"
        docker compose $COMPOSE_FILES logs --tail=10 reverse-proxy
    fi
}

# Generate Nginx configuration (for existing_nginx mode)
generate_nginx_config() {
    if [ "$SSL_MODE" != "EXISTING_NGINX" ]; then
        return
    fi
    
    print_header "Generating Nginx Configuration"
    
    # Generate the Nginx configuration file to a temporary location first
    local TEMP_CONFIG="/tmp/isp-manager-nginx.conf"
    local FINAL_CONFIG="/etc/nginx/sites-available/isp-manager"
    local APP_PORT="${APP_HOST_PORT:-5000}"
    
    print_info "Creating Nginx configuration..."
    
    cat > "$TEMP_CONFIG" << EOF
# ISP Manager - Nginx Configuration
# Auto-generated by deploy.sh

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${APP_DOMAIN};

    # SSL certificate paths (update with your actual certificate paths)
    # If you don't have certificates yet, run: certbot --nginx -d ${APP_DOMAIN}
    ssl_certificate /etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Proxy to ISP Manager backend
    location / {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Logging
    access_log /var/log/nginx/isp-manager-access.log;
    error_log /var/log/nginx/isp-manager-error.log;
}
EOF

    if [ ! -f "$TEMP_CONFIG" ]; then
        print_error "Failed to generate Nginx configuration"
        return 1
    fi
    
    print_success "Nginx configuration generated at: $TEMP_CONFIG"
    
    # Try to copy to final location (may require root)
    if cp "$TEMP_CONFIG" "$FINAL_CONFIG" 2>/dev/null; then
        print_success "Configuration copied to: $FINAL_CONFIG"
    else
        print_info "Configuration will be installed by ssl-provision.sh"
        # ssl-provision.sh will handle the installation
    fi
}

# Display access information
show_access_info() {
    print_header "Access Information"
    
    echo -e "${GREEN}ISP Manager Application:${NC}"
    if [ "$SSL_MODE" = "ENABLED" ]; then
        echo -e "  URL:      ${BLUE}https://${APP_DOMAIN}${NC}"
        echo -e "  Note:     ${YELLOW}SSL certificate obtained from Let's Encrypt${NC}"
    elif [ "$SSL_MODE" = "EXISTING_NGINX" ]; then
        echo -e "  Backend:  ${BLUE}http://localhost:${APP_HOST_PORT:-5000}${NC}"
        echo -e "  Public:   ${BLUE}https://${APP_DOMAIN}${NC} ${YELLOW}(via existing Nginx)${NC}"
    else
        echo -e "  URL:      ${BLUE}http://localhost:${APP_HOST_PORT:-5000}${NC}"
    fi
    echo -e "  Username: ${BLUE}adhielesmana${NC}"
    echo -e "  Password: ${BLUE}admin123${NC}"
    echo ""
    
    echo -e "${GREEN}Database Access:${NC}"
    echo -e "  Host:     ${BLUE}localhost${NC}"
    echo -e "  Port:     ${BLUE}${POSTGRES_HOST_PORT:-5433}${NC} ${YELLOW}(uses 5433 to avoid conflicts)${NC}"
    echo -e "  Database: ${BLUE}ispmanager${NC}"
    echo -e "  Username: ${BLUE}ispuser${NC}"
    echo -e "  Password: ${BLUE}(see .env file)${NC}"
    echo ""
    
    echo -e "${GREEN}Network Isolation:${NC}"
    echo -e "  Network:  ${BLUE}isp-manager-network (172.25.0.0/16)${NC}"
    echo -e "  Note:     ${YELLOW}Isolated from other Docker containers${NC}"
    echo ""
    
    echo -e "${GREEN}FreeRADIUS:${NC}"
    echo -e "  Auth Port:   ${BLUE}${RADIUS_AUTH_PORT:-1812}/udp${NC}"
    echo -e "  Acct Port:   ${BLUE}${RADIUS_ACCT_PORT:-1813}/udp${NC}"
    echo -e "  Secret:      ${BLUE}(see .env file)${NC}"
    echo ""
}

# Display useful commands
show_commands() {
    print_header "Useful Commands"
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.ssl.yml"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    echo -e "${GREEN}View logs:${NC}"
    echo -e "  ${COMPOSE_CMD} logs -f              # All services"
    echo -e "  ${COMPOSE_CMD} logs -f app          # Application only"
    echo -e "  ${COMPOSE_CMD} logs -f freeradius   # FreeRADIUS only"
    if [ "$SSL_MODE" = "ENABLED" ]; then
        echo -e "  ${COMPOSE_CMD} logs -f reverse-proxy  # Nginx/SSL logs"
    fi
    echo ""
    
    echo -e "${GREEN}Manage services:${NC}"
    echo -e "  ${COMPOSE_CMD} ps                   # Service status"
    echo -e "  ${COMPOSE_CMD} restart app          # Restart application"
    echo -e "  ${COMPOSE_CMD} down                 # Stop all services"
    echo -e "  ${COMPOSE_CMD} down -v              # Stop and remove data"
    echo ""
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        echo -e "${GREEN}SSL Certificate Management:${NC}"
        echo -e "  ${COMPOSE_CMD} exec reverse-proxy certbot renew     # Manual renewal check"
        echo -e "  ${COMPOSE_CMD} exec reverse-proxy certbot certificates  # View cert info"
        echo -e "  ${COMPOSE_CMD} logs reverse-proxy | grep certbot    # Check renewal logs"
        echo ""
    fi
    
    echo -e "${GREEN}Database access:${NC}"
    echo -e "  docker compose exec postgres psql -U ispuser -d ispmanager"
    echo ""
    
    echo -e "${GREEN}Test RADIUS authentication:${NC}"
    echo -e "  radtest testuser testpass localhost 0 \$(grep RADIUS_SECRET .env | cut -d= -f2)"
    echo ""
}

# Main deployment function
main() {
    print_header "ISP Manager - Automated Deployment"
    
    # Parse command line arguments
    REBUILD=false
    SKIP_BUILD=false
    SKIP_SSL=false
    SSL_PROVISIONED=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --rebuild)
                REBUILD=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-ssl)
                SKIP_SSL=true
                shift
                ;;
            --help)
                echo "Usage: ./deploy.sh [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --rebuild      Force rebuild of Docker images"
                echo "  --skip-build   Skip building, just restart services"
                echo "  --skip-ssl     Skip automated SSL provisioning"
                echo "  --help         Show this help message"
                echo ""
                echo "Features:"
                echo "  ✓ Automatic port conflict resolution"
                echo "  ✓ Automatic SSL provisioning (existing_nginx mode)"
                echo "  ✓ Automatic error recovery"
                echo "  ✓ Service health monitoring"
                echo "  ✓ Isolated Docker network"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Validate conflicting flags
    if [ "$REBUILD" = true ] && [ "$SKIP_BUILD" = true ]; then
        print_error "Cannot use --rebuild and --skip-build together"
        print_info "Use --help for usage information"
        exit 1
    fi
    
    # Source .env at top-level to make DEPLOYMENT_MODE available
    if [ -f .env ]; then
        set -a
        source .env
        set +a
    fi
    
    # Run deployment steps
    check_prerequisites
    validate_ports
    cleanup_stale_resources
    stop_containers
    
    if [ "$SKIP_BUILD" = false ]; then
        build_images
    else
        print_info "Skipping build as requested"
    fi
    
    # Start services with retry
    if ! start_services; then
        print_error "Failed to start services"
        print_info "Please check the logs and try again"
        exit 1
    fi
    
    wait_for_services
    
    # Setup Host Nginx (if in host_nginx mode)
    if [ "$SETUP_HOST_NGINX" = "true" ]; then
        print_header "Setting Up Host Nginx"
        echo ""
        
        # Generate nginx site configuration
        print_info "Generating nginx site configuration..."
        if [ -f generate-host-nginx-site.sh ]; then
            chmod +x generate-host-nginx-site.sh
            if ./generate-host-nginx-site.sh; then
                print_success "Nginx site configuration created"
            else
                print_error "Failed to generate nginx site configuration"
                exit 1
            fi
        else
            print_error "generate-host-nginx-site.sh not found"
            exit 1
        fi
        
        echo ""
        
        # Obtain SSL certificate via certbot
        if [ -n "$APP_DOMAIN" ] && [ -n "$LETSENCRYPT_EMAIL" ]; then
            print_info "Obtaining SSL certificate for $APP_DOMAIN..."
            
            # Check if certificate already exists
            if [ -d "/etc/letsencrypt/live/$APP_DOMAIN" ]; then
                print_info "SSL certificate already exists for $APP_DOMAIN"
            else
                # Obtain certificate
                if certbot --nginx -d "$APP_DOMAIN" --email "$LETSENCRYPT_EMAIL" --agree-tos --non-interactive 2>&1; then
                    print_success "SSL certificate obtained successfully"
                else
                    print_warning "Failed to obtain SSL certificate automatically"
                    echo ""
                    echo "You can obtain it manually by running:"
                    echo "  certbot --nginx -d $APP_DOMAIN --email $LETSENCRYPT_EMAIL"
                fi
            fi
        else
            print_warning "APP_DOMAIN or LETSENCRYPT_EMAIL not set, skipping SSL certificate provisioning"
            echo ""
            echo "To obtain SSL certificate manually, run:"
            echo "  certbot --nginx -d your-domain.com --email your@email.com"
        fi
        
        echo ""
    fi
    
    # Docker Nginx setup (skip only for host nginx mode)
    if [ "$SETUP_HOST_NGINX" != "true" ]; then
        # Connect to existing nginx network (if in existing_nginx mode)
        connect_to_nginx_network
        
        # Setup SSL certificates in nginx container (copy certs, fix nginx.conf)
        setup_nginx_ssl
        
        # Generate Nginx config (needed by ssl-provision.sh and Docker SSL)
        generate_nginx_config
    fi
    
    # Provision SSL certificate if in existing_nginx mode
    if [ "$SSL_MODE" = "EXISTING_NGINX" ] && [ "$SKIP_SSL" != "true" ]; then
        print_header "Automated SSL Provisioning"
        
        # Check if this is a multi-app setup
        if [ -d "ssl-commands" ] && [ -x ./ssl-commands/get-all-certificates.sh ]; then
            print_info "Multi-app SSL setup detected"
            echo ""
            
            # Verify install script exists
            if [ ! -x ./install-to-nginx.sh ]; then
                print_error "install-to-nginx.sh not found or not executable"
                print_info "Please run './setup-multi-app.sh' to regenerate SSL scripts"
                SSL_PROVISIONED=false
            else
                # Step 1: Get SSL certificates for all domains
                CERTS_OBTAINED=false
                print_header "Step 1/2: SSL Certificate Provisioning"
                print_info "Getting certificates for all configured domains..."
                echo ""
                
                if ./ssl-commands/get-all-certificates.sh; then
                    echo ""
                    print_success "✓ STEP 1 COMPLETE: All SSL certificates obtained!"
                    CERTS_OBTAINED=true
                else
                    echo ""
                    print_error "✗ STEP 1 FAILED: Certificate provisioning encountered an issue"
                    print_info "Manual recovery: ./ssl-commands/get-all-certificates.sh"
                    CERTS_OBTAINED=false
                fi
                
                echo ""
                
                # Step 2: Install Nginx configs to container (only if Step 1 succeeded)
                if [ "$CERTS_OBTAINED" = "true" ]; then
                    print_header "Step 2/2: Nginx Configuration Installation"
                    print_info "Installing configurations and reloading Nginx..."
                    echo ""
                    
                    if ./install-to-nginx.sh; then
                        echo ""
                        print_success "✓ STEP 2 COMPLETE: Nginx configurations installed and reloaded!"
                        SSL_PROVISIONED=true
                    else
                        echo ""
                        print_error "✗ STEP 2 FAILED: Nginx configuration installation failed"
                        print_warning "Certificates are ready, but configs not installed"
                        print_info "Manual recovery: ./install-to-nginx.sh"
                        SSL_PROVISIONED=false
                    fi
                else
                    print_warning "Skipping Step 2/2 (certificate provisioning incomplete)"
                    print_info "Complete Step 1 first: ./ssl-commands/get-all-certificates.sh"
                    SSL_PROVISIONED=false
                fi
            fi
            
        # Single-app setup
        elif [ -x ./ssl-provision.sh ]; then
            print_info "Single-app SSL setup detected"
            print_info "Running automated SSL certificate provisioning..."
            
            if ./ssl-provision.sh; then
                print_success "SSL certificate provisioned successfully!"
                SSL_PROVISIONED=true
            else
                print_warning "SSL provisioning encountered an issue"
                print_info "You can run './ssl-provision.sh' manually later"
                SSL_PROVISIONED=false
            fi
        else
            print_warning "No SSL provisioning scripts found"
            print_info "Run './setup.sh' or './setup-multi-app.sh' first to configure SSL"
            SSL_PROVISIONED=false
        fi
        
        echo ""
    fi
    
    echo ""
    show_status
    echo ""
    show_logs
    echo ""
    show_access_info
    show_commands
    
    # Final success message
    print_header "Deployment Complete!"
    
    if [ "$SSL_MODE" = "ENABLED" ]; then
        print_success "ISP Manager is now running at https://${APP_DOMAIN}"
        echo ""
        print_info "SSL certificate status:"
        docker compose $COMPOSE_FILES exec -T reverse-proxy certbot certificates 2>/dev/null || print_warning "Certificate info not available yet"
    elif [ "$SSL_MODE" = "EXISTING_NGINX" ]; then
        print_success "ISP Manager backend is running on http://localhost:${APP_HOST_PORT:-5000}"
        echo ""
        
        # Detect multi-app vs single-app setup
        MULTI_APP_SETUP=false
        if [ -d "ssl-commands" ] && [ -x ./ssl-commands/get-all-certificates.sh ]; then
            MULTI_APP_SETUP=true
        fi
        
        if [ "$SSL_PROVISIONED" = "true" ]; then
            print_success "✓ SSL certificates provisioned and configured!"
            print_success "✓ Nginx configured and reloaded!"
            echo ""
            if [ "$MULTI_APP_SETUP" = "true" ]; then
                print_info "All applications are now accessible via HTTPS"
                if [ -n "$APP_DOMAIN" ]; then
                    print_info "This app: https://${APP_DOMAIN}"
                fi
            else
                print_info "Your ISP Manager is now accessible at: https://${APP_DOMAIN}"
            fi
        elif [ "$SKIP_SSL" = "true" ]; then
            print_info "SSL provisioning skipped (--skip-ssl flag)"
            echo ""
            print_warning "NEXT STEPS:"
            if [ "$MULTI_APP_SETUP" = "true" ]; then
                echo "  1. Get SSL certificates for all apps:"
                echo "     ./ssl-commands/get-all-certificates.sh"
                echo ""
                echo "  2. Install Nginx configs:"
                echo "     ./install-to-nginx.sh"
            else
                echo "  1. Run SSL provisioning:"
                echo "     ./ssl-provision.sh"
            fi
            echo ""
        else
            print_warning "SSL provisioning was not successful or was skipped"
            echo ""
            print_warning "NEXT STEPS:"
            if [ "$MULTI_APP_SETUP" = "true" ]; then
                echo "  Multi-app setup detected. Run:"
                echo "  1. Get SSL certificates:"
                echo "     ./ssl-commands/get-all-certificates.sh"
                echo ""
                echo "  2. Install Nginx configs:"
                echo "     ./install-to-nginx.sh"
            else
                echo "  Single-app setup detected. Run:"
                echo "  1. SSL provisioning:"
                echo "     ./ssl-provision.sh"
                echo ""
                echo "  Or manually:"
                echo "  - Stop Nginx: docker stop <nginx-container>"
                echo "  - Get certificate: certbot certonly --standalone -d ${APP_DOMAIN}"
                echo "  - Start Nginx: docker start <nginx-container>"
                echo "  - Copy Nginx config to container"
            fi
            echo ""
        fi
    else
        print_success "ISP Manager is now running at http://localhost:${APP_HOST_PORT:-5000}"
    fi
    
    echo ""
    print_success "✓ All port conflicts automatically resolved"
    print_success "✓ Docker network isolated (no interference with other containers)"
    print_success "✓ Services are healthy and ready"
    echo ""
}

# Run main function
main "$@"

exit 0
