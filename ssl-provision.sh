#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo "================================================"
    echo -e "${BLUE}$1${NC}"
    echo "================================================"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Load configuration
if [ ! -f .env ]; then
    print_error ".env file not found! Run ./setup.sh first"
    exit 1
fi

source .env

# Map variable names (support both naming conventions)
DOMAIN="${APP_DOMAIN:-$DOMAIN}"
SSL_EMAIL="${LETSENCRYPT_EMAIL:-$SSL_EMAIL}"

# Validate required variables
if [ -z "$DOMAIN" ] || [ -z "$SSL_EMAIL" ]; then
    print_error "APP_DOMAIN and LETSENCRYPT_EMAIL must be set in .env"
    exit 1
fi

if [ "$ENABLE_SSL" != "existing_nginx" ]; then
    print_info "SSL mode is not 'existing_nginx', skipping SSL provisioning"
    exit 0
fi

print_header "Automated SSL Certificate Provisioning"

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    print_error "certbot is not installed!"
    echo ""
    echo "Install certbot:"
    echo "  Ubuntu/Debian: apt-get install -y certbot"
    echo "  CentOS/RHEL:   yum install -y certbot"
    exit 1
fi

# Check if certificate already exists and is valid
CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
if [ -f "$CERT_PATH" ]; then
    # Check expiry date
    EXPIRY=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -gt 30 ]; then
        print_success "Valid SSL certificate already exists (expires in $DAYS_LEFT days)"
        print_info "Skipping certificate provisioning"
        exit 0
    else
        print_info "Certificate expires in $DAYS_LEFT days, will renew"
    fi
fi

# Auto-detect Nginx container
print_header "Detecting Nginx Container"

NGINX_CONTAINER=""
NGINX_CONTAINERS=$(docker ps --filter "ancestor=nginx" --format "{{.Names}}" 2>/dev/null || true)

if [ -z "$NGINX_CONTAINERS" ]; then
    # Try alternative detection - any container with nginx in the name
    NGINX_CONTAINERS=$(docker ps --format "{{.Names}}" | grep -i nginx || true)
fi

if [ -z "$NGINX_CONTAINERS" ]; then
    print_error "No running Nginx container found!"
    echo ""
    echo "Please ensure your Nginx container is running."
    echo "Or manually specify: NGINX_CONTAINER=<name> ./ssl-provision.sh"
    exit 1
fi

# Count containers
CONTAINER_COUNT=$(echo "$NGINX_CONTAINERS" | wc -l)

if [ $CONTAINER_COUNT -eq 1 ]; then
    NGINX_CONTAINER="$NGINX_CONTAINERS"
    print_success "Detected Nginx container: $NGINX_CONTAINER"
elif [ -n "$NGINX_CONTAINER" ]; then
    # User specified container via environment variable
    print_success "Using specified Nginx container: $NGINX_CONTAINER"
else
    # Multiple containers found, ask user to specify
    print_error "Multiple Nginx containers found:"
    echo "$NGINX_CONTAINERS"
    echo ""
    echo "Please specify which one to use:"
    echo "  NGINX_CONTAINER=<name> ./ssl-provision.sh"
    exit 1
fi

# Verify container is running
if ! docker ps --format "{{.Names}}" | grep -q "^${NGINX_CONTAINER}$"; then
    print_error "Container $NGINX_CONTAINER is not running!"
    exit 1
fi

# Check if /etc/letsencrypt is mounted in Nginx container
print_header "Checking Certificate Mount"

MOUNTS=$(docker inspect "$NGINX_CONTAINER" --format '{{json .Mounts}}' 2>/dev/null || echo "[]")

if echo "$MOUNTS" | grep -q "/etc/letsencrypt"; then
    print_success "/etc/letsencrypt is already mounted in Nginx container"
else
    print_warning "/etc/letsencrypt is NOT mounted in Nginx container"
    echo ""
    echo "WARNING: Nginx container needs /etc/letsencrypt mounted to access certificates!"
    echo ""
    echo "Add this volume mount to your Nginx container:"
    echo "  -v /etc/letsencrypt:/etc/letsencrypt:ro"
    echo ""
    echo "Example docker run command:"
    echo "  docker run -d --name nginx \\"
    echo "    -p 80:80 -p 443:443 \\"
    echo "    -v /etc/letsencrypt:/etc/letsencrypt:ro \\"
    echo "    -v /etc/nginx/conf.d:/etc/nginx/conf.d \\"
    echo "    nginx:latest"
    echo ""
    print_error "Cannot continue without /etc/letsencrypt mount"
    print_info "Please recreate your Nginx container with the volume mount above"
    exit 1
fi

# Stop Nginx temporarily to free port 80
print_header "Obtaining SSL Certificate"

print_info "Stopping Nginx container temporarily..."
docker stop "$NGINX_CONTAINER"

# Store the stop time for rollback
NGINX_STOPPED=true

# Function to restart Nginx (for error handling)
restart_nginx() {
    if [ "$NGINX_STOPPED" = true ]; then
        print_info "Restarting Nginx container..."
        docker start "$NGINX_CONTAINER"
        NGINX_STOPPED=false
    fi
}

# Trap errors to ensure Nginx restarts
trap restart_nginx EXIT

# Wait a moment for port to be freed
sleep 2

# Run certbot
print_info "Running certbot for domain: $DOMAIN"

if certbot certonly --standalone \
    -d "$DOMAIN" \
    -m "$SSL_EMAIL" \
    --agree-tos \
    --non-interactive \
    --preferred-challenges http; then
    print_success "SSL certificate obtained successfully!"
else
    print_error "Failed to obtain SSL certificate"
    restart_nginx
    exit 1
fi

# Restart Nginx
restart_nginx

# Wait for Nginx to start
sleep 2

# Install Nginx configuration
print_header "Installing Nginx Configuration"

# Check both possible locations
NGINX_CONFIG="/etc/nginx/sites-available/isp-manager"
TEMP_CONFIG="/tmp/isp-manager-nginx.conf"

if [ -f "$NGINX_CONFIG" ]; then
    CONFIG_SOURCE="$NGINX_CONFIG"
    print_info "Using configuration from: $NGINX_CONFIG"
elif [ -f "$TEMP_CONFIG" ]; then
    CONFIG_SOURCE="$TEMP_CONFIG"
    print_info "Using configuration from: $TEMP_CONFIG"
else
    print_error "Nginx configuration not found!"
    print_info "Expected locations:"
    echo "  - /etc/nginx/sites-available/isp-manager"
    echo "  - /tmp/isp-manager-nginx.conf"
    echo ""
    print_info "Run ./setup.sh or ./deploy.sh to generate the configuration"
    exit 1
fi

# Copy config to Nginx container
print_info "Copying configuration to Nginx container..."

if docker cp "$CONFIG_SOURCE" "$NGINX_CONTAINER:/etc/nginx/conf.d/isp-manager.conf"; then
    print_success "Configuration copied successfully"
else
    print_error "Failed to copy configuration"
    exit 1
fi

# Test Nginx configuration
print_info "Testing Nginx configuration..."

if docker exec "$NGINX_CONTAINER" nginx -t; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed!"
    echo ""
    echo "Removing invalid configuration..."
    docker exec "$NGINX_CONTAINER" rm /etc/nginx/conf.d/isp-manager.conf
    exit 1
fi

# Reload Nginx
print_info "Reloading Nginx..."

if docker exec "$NGINX_CONTAINER" nginx -s reload; then
    print_success "Nginx reloaded successfully"
else
    # Try restart if reload fails
    print_info "Reload failed, restarting container..."
    docker restart "$NGINX_CONTAINER"
    sleep 3
    print_success "Nginx restarted successfully"
fi

# Verify SSL is working
print_header "Verification"

print_success "SSL certificate provisioned and configured!"
echo ""
echo "Domain:      $DOMAIN"
echo "Certificate: $CERT_PATH"
echo "Expires:     $(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)"
echo ""
print_info "Testing HTTPS connection..."

sleep 3

if curl -k -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" | grep -q "200\|301\|302"; then
    print_success "HTTPS is working! Visit: https://$DOMAIN"
else
    print_info "Could not verify HTTPS (may take a moment to propagate)"
    echo ""
    echo "Manually test: https://$DOMAIN"
fi

echo ""
print_header "Certificate Renewal"
echo ""
echo "Certificates auto-renew via certbot timer/cron."
echo "Check status: systemctl status certbot.timer"
echo ""
echo "Manual renewal:"
echo "  certbot renew"
echo "  docker restart $NGINX_CONTAINER"
echo ""

print_success "SSL provisioning complete! ✨"
