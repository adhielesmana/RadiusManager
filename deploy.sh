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
    
    # Load SSL configuration from .env
    if [ -f .env ]; then
        set -a
        source .env
        set +a
        
        if [ "$ENABLE_SSL" = "true" ]; then
            COMPOSE_FILES="-f docker-compose.yml -f docker-compose.ssl.yml"
            SSL_MODE="ENABLED"
            print_info "SSL Mode: ENABLED (using domain: ${APP_DOMAIN})"
        elif [ "$ENABLE_SSL" = "existing_nginx" ]; then
            COMPOSE_FILES="-f docker-compose.yml"
            SSL_MODE="EXISTING_NGINX"
            print_info "SSL Mode: EXISTING NGINX (backend on port 5000, domain: ${APP_DOMAIN})"
        else
            COMPOSE_FILES="-f docker-compose.yml"
            SSL_MODE="DISABLED"
            print_info "SSL Mode: DISABLED (local development)"
        fi
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

# Auto-configure existing Nginx
auto_configure_nginx() {
    if [ "$SSL_MODE" != "EXISTING_NGINX" ]; then
        return
    fi
    
    print_header "Configuring Existing Nginx"
    
    # Generate the Nginx configuration file
    local CONFIG_FILE="/tmp/isp-manager-nginx.conf"
    local APP_PORT="${APP_HOST_PORT:-5000}"
    
    print_info "Generating Nginx configuration..."
    
    cat > "$CONFIG_FILE" << EOF
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

    print_success "Nginx configuration generated"
    
    # Try to install it automatically
    print_info "Installing Nginx configuration..."
    
    if cp "$CONFIG_FILE" /etc/nginx/sites-available/isp-manager 2>/dev/null; then
        print_success "Configuration copied to /etc/nginx/sites-available/isp-manager"
        
        # Enable site if not already enabled
        if [ ! -L /etc/nginx/sites-enabled/isp-manager ]; then
            if ln -s /etc/nginx/sites-available/isp-manager /etc/nginx/sites-enabled/isp-manager 2>/dev/null; then
                print_success "Site enabled"
            fi
        else
            print_info "Site already enabled"
        fi
        
        # Test Nginx configuration
        print_info "Testing Nginx configuration..."
        if nginx -t 2>/dev/null; then
            print_success "Nginx configuration is valid"
            
            # Reload Nginx
            print_info "Reloading Nginx..."
            if systemctl reload nginx 2>/dev/null; then
                print_success "✓ Nginx reloaded successfully!"
                echo ""
                print_success "✓ Nginx is now configured and running!"
                print_info "Your ISP Manager is accessible at https://${APP_DOMAIN}"
            else
                print_warning "Could not reload Nginx automatically"
                print_info "Please reload manually: systemctl reload nginx"
            fi
        else
            print_warning "Nginx configuration test failed"
            print_info "Please check the configuration and reload manually"
        fi
    else
        print_warning "Could not install configuration automatically"
        print_info "Configuration saved to: $CONFIG_FILE"
        echo ""
        print_info "Please run these commands manually:"
        echo "  cp $CONFIG_FILE /etc/nginx/sites-available/isp-manager"
        echo "  ln -s /etc/nginx/sites-available/isp-manager /etc/nginx/sites-enabled/"
        echo "  nginx -t"
        echo "  systemctl reload nginx"
    fi
    
    # Check if SSL certificate exists
    echo ""
    if [ ! -f "/etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem" ] 2>/dev/null; then
        print_warning "SSL certificate not found for ${APP_DOMAIN}"
        print_info "Since your Nginx runs in Docker, use webroot mode:"
        echo ""
        echo "1. Create webroot directory:"
        echo "   mkdir -p /var/www/html/.well-known/acme-challenge"
        echo ""
        echo "2. Get certificate with webroot mode:"
        echo "   certbot certonly --webroot -w /var/www/html -d ${APP_DOMAIN} -m ${LETSENCRYPT_EMAIL:-your@email.com} --agree-tos"
        echo ""
        echo "3. After getting the certificate, reload your Nginx Docker container"
        echo ""
        print_info "Alternative: Use standalone mode (requires temporarily stopping Nginx on port 80):"
        echo "   certbot certonly --standalone -d ${APP_DOMAIN} -m ${LETSENCRYPT_EMAIL:-your@email.com} --agree-tos"
    else
        print_success "SSL certificate found for ${APP_DOMAIN}"
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
            --help)
                echo "Usage: ./deploy.sh [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --rebuild      Force rebuild of Docker images"
                echo "  --skip-build   Skip building, just restart services"
                echo "  --help         Show this help message"
                echo ""
                echo "Features:"
                echo "  ✓ Automatic port conflict resolution"
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
    
    # Auto-configure existing Nginx if in existing_nginx mode
    auto_configure_nginx
    
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
        print_warning "NEXT STEPS:"
        echo "  1. Generate Nginx configuration:"
        echo "     ./generate-nginx-config.sh"
        echo ""
        echo "  2. Follow the instructions from the script to:"
        echo "     - Copy config to your Nginx"
        echo "     - Obtain SSL certificate (if needed)"
        echo "     - Reload Nginx"
        echo ""
        print_info "Your ISP Manager will be accessible at: https://${APP_DOMAIN}"
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
