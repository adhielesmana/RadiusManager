#!/bin/bash
set -e

# Multi-App Setup Script
# Configure multiple applications with different domains on one server

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Detect Nginx running in Docker with PUBLICLY exposed ports 80/443
detect_nginx_docker() {
    # Check if Docker is available and running
    if ! command_exists docker || ! docker ps >/dev/null 2>&1; then
        return 1
    fi
    
    # Find containers with publicly exposed ports 80 or 443 (0.0.0.0 or ::)
    local ALL_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null)
    
    for CONTAINER in $ALL_CONTAINERS; do
        # Check if container has public port 80 or 443 binding
        local PORT_BINDINGS=$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}' 2>/dev/null)
        
        if echo "$PORT_BINDINGS" | grep -qE '"(80|443)/tcp".*"HostIp":"(0\.0\.0\.0|::)"'; then
            # Check if it's nginx or proxy related
            local IMAGE=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
            
            if echo "$CONTAINER $IMAGE" | grep -iqE "(nginx|proxy)"; then
                # Found a matching container
                echo "$CONTAINER"
                return 0
            fi
        fi
    done
    
    return 1
}

# Check if Nginx container has /etc/letsencrypt mounted
check_nginx_letsencrypt_mount() {
    local CONTAINER=$1
    
    if [ -z "$CONTAINER" ]; then
        return 1
    fi
    
    # Check if /etc/letsencrypt is mounted
    docker inspect "$CONTAINER" 2>/dev/null | grep -q "/etc/letsencrypt" && return 0
    return 1
}

# Store app configurations
declare -a APP_NAMES
declare -a APP_DOMAINS
declare -a APP_PORTS
declare -a ASSIGNED_PORTS  # Track ports assigned in this session

# Check if port detection tools are available
PORT_DETECTION_AVAILABLE=true
check_port_detection_tools() {
    if ! command -v netstat >/dev/null 2>&1 && \
       ! command -v ss >/dev/null 2>&1 && \
       ! command -v lsof >/dev/null 2>&1; then
        PORT_DETECTION_AVAILABLE=false
        print_warning "Port detection tools (netstat/ss/lsof) not found"
        print_info "Port availability checks will be disabled - please verify ports manually"
        echo ""
    fi
}

# Check if a port is in use
check_port_in_use() {
    local PORT=$1
    
    # If no detection tools, assume port is free
    if [ "$PORT_DETECTION_AVAILABLE" = false ]; then
        return 1
    fi
    
    if command -v netstat >/dev/null 2>&1; then
        netstat -tuln 2>/dev/null | grep -q ":$PORT "
    elif command -v ss >/dev/null 2>&1; then
        ss -tuln 2>/dev/null | grep -q ":$PORT "
    elif command -v lsof >/dev/null 2>&1; then
        lsof -i ":$PORT" >/dev/null 2>&1
    else
        # Fallback - assume port is free
        return 1
    fi
}

# Check if port is already assigned in this session
is_port_assigned() {
    local PORT=$1
    for ASSIGNED in "${ASSIGNED_PORTS[@]}"; do
        if [ "$ASSIGNED" = "$PORT" ]; then
            return 0
        fi
    done
    return 1
}

# Find next available port starting from a given port
find_available_port() {
    local START_PORT=${1:-5000}
    local MAX_ATTEMPTS=100
    local PORT=$START_PORT
    
    for ((i=0; i<MAX_ATTEMPTS; i++)); do
        # Check if port is in use or already assigned
        if ! check_port_in_use $PORT && ! is_port_assigned $PORT; then
            echo $PORT
            return 0
        fi
        PORT=$((PORT + 1))
    done
    
    # If we couldn't find a port, return 0 (error)
    echo 0
    return 1
}

# Suggest a port based on app number
suggest_port() {
    local APP_NUM=$1
    local BASE_PORT=5000
    local SUGGESTED_PORT=$((BASE_PORT + (APP_NUM - 1) * 100))
    
    # Find available port starting from suggested
    AVAILABLE=$(find_available_port $SUGGESTED_PORT)
    echo $AVAILABLE
}

print_header "Multi-App Deployment Setup"
echo ""
echo "This script will help you configure multiple applications"
echo "on one server with your existing Nginx."
echo ""
print_info "Each app will have its own domain and Nginx configuration"
echo ""

# Check for port detection tools
check_port_detection_tools

# Auto-detect Nginx in Docker
print_header "Nginx Detection"

DETECTED_NGINX=$(detect_nginx_docker)

if [ -n "$DETECTED_NGINX" ]; then
    print_success "Detected Nginx Docker container: $DETECTED_NGINX"
    echo ""
    
    echo -e "${GREEN}Automatic SSL Configuration Available!${NC}"
    echo "  • Your Nginx container is running on ports 80/443"
    echo "  • Each app will run on a different port (5000, 5100, etc.)"
    echo "  • Automated SSL certificate provisioning with Let's Encrypt"
    echo "  • Automatic Nginx configuration generation for all apps"
    echo ""
    
    # Check if /etc/letsencrypt is mounted
    if check_nginx_letsencrypt_mount "$DETECTED_NGINX"; then
        print_success "/etc/letsencrypt is already mounted in Nginx container"
    else
        print_warning "/etc/letsencrypt is NOT mounted in Nginx container"
        echo ""
        echo -e "${YELLOW}Important: Your Nginx container needs this volume mount:${NC}"
        echo "  -v /etc/letsencrypt:/etc/letsencrypt:ro"
        echo ""
        echo "SSL provisioning may fail without this mount."
    fi
    
    echo ""
    print_info "This setup will create separate .env files for each app"
    print_info "Each app will be configured to use $DETECTED_NGINX for SSL"
    echo ""
else
    print_info "No Nginx Docker container detected on ports 80/443"
    print_info "Make sure you have Nginx running if you want SSL/HTTPS"
    echo ""
fi

# Detect running Docker containers
print_header "Detecting Running Docker Containers"

if command -v docker >/dev/null 2>&1 && docker ps >/dev/null 2>&1; then
    CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null)
    
    if [ -n "$CONTAINERS" ]; then
        echo ""
        print_success "Found running Docker containers:"
        echo ""
        
        # Show container details with name, image, and ports
        docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}" 2>/dev/null | head -20
        
        echo ""
        print_info "Port suggestions will automatically avoid these containers"
        echo ""
    else
        print_info "No running Docker containers found"
        echo ""
    fi
else
    print_info "Docker not available or not running - port detection will use system ports only"
    echo ""
fi

# Ask for email (shared across all apps)
print_header "SSL Configuration"
echo ""
echo -e "${BLUE}All applications will use the same email for SSL certificates${NC}"
echo ""

while true; do
    read -p "Enter your email for Let's Encrypt SSL certificates: " SSL_EMAIL
    if [ -n "$SSL_EMAIL" ] && [[ "$SSL_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        break
    fi
    print_error "Valid email address is required"
done

echo ""

# Ask how many apps
while true; do
    read -p "How many applications do you want to configure? (1-10): " NUM_APPS
    if [[ "$NUM_APPS" =~ ^[0-9]+$ ]] && [ "$NUM_APPS" -ge 1 ] && [ "$NUM_APPS" -le 10 ]; then
        break
    fi
    print_error "Please enter a number between 1 and 10"
done

echo ""
print_success "Configuring $NUM_APPS application(s)"
echo ""

# Collect information for each app
for ((i=1; i<=NUM_APPS; i++)); do
    print_header "Application $i of $NUM_APPS"
    echo ""
    
    # App name
    while true; do
        read -p "App $i - Name/Identifier (e.g., isp-manager, monitoring): " APP_NAME
        if [ -n "$APP_NAME" ]; then
            # Sanitize app name (lowercase, no spaces)
            APP_NAME=$(echo "$APP_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
            break
        fi
        print_error "App name cannot be empty"
    done
    
    # Domain
    while true; do
        read -p "App $i - Domain name (e.g., isp.maxnetplus.id): " APP_DOMAIN
        if [ -n "$APP_DOMAIN" ]; then
            break
        fi
        print_error "Domain cannot be empty"
    done
    
    # Port - Auto-detect and suggest
    SUGGESTED_PORT=$(suggest_port $i)
    
    if [ "$SUGGESTED_PORT" -eq 0 ]; then
        print_error "Could not find available port automatically"
        while true; do
            read -p "App $i - Port number (enter manually): " APP_PORT
            if [[ "$APP_PORT" =~ ^[0-9]+$ ]] && [ "$APP_PORT" -ge 1024 ] && [ "$APP_PORT" -le 65535 ]; then
                if is_port_assigned $APP_PORT; then
                    print_error "Port $APP_PORT already assigned to another app in this session"
                elif check_port_in_use $APP_PORT; then
                    print_warning "Port $APP_PORT is already in use"
                    read -p "Use it anyway? (y/n) " -n 1 -r
                    echo
                    if [[ $REPLY =~ ^[Yy]$ ]]; then
                        # Even if forcing, check for session duplicates
                        if is_port_assigned $APP_PORT; then
                            print_error "Port $APP_PORT already assigned to another app in this session"
                        else
                            break
                        fi
                    fi
                else
                    break
                fi
            else
                print_error "Please enter a valid port number (1024-65535)"
            fi
        done
    else
        echo ""
        print_success "Suggested available port: $SUGGESTED_PORT"
        read -p "App $i - Use port $SUGGESTED_PORT or enter custom port [Enter=$SUGGESTED_PORT]: " APP_PORT
        
        # If user just pressed Enter, use suggested port
        if [ -z "$APP_PORT" ]; then
            APP_PORT=$SUGGESTED_PORT
        else
            # Validate custom port
            while true; do
                if [[ "$APP_PORT" =~ ^[0-9]+$ ]] && [ "$APP_PORT" -ge 1024 ] && [ "$APP_PORT" -le 65535 ]; then
                    if is_port_assigned $APP_PORT; then
                        print_error "Port $APP_PORT already assigned to another app in this session"
                        read -p "Enter a different port: " APP_PORT
                    elif check_port_in_use $APP_PORT; then
                        print_warning "Port $APP_PORT is already in use"
                        read -p "Use it anyway? (y/n) " -n 1 -r
                        echo
                        if [[ $REPLY =~ ^[Yy]$ ]]; then
                            # Even if forcing, check for session duplicates
                            if is_port_assigned $APP_PORT; then
                                print_error "Port $APP_PORT already assigned to another app in this session"
                                read -p "Enter a different port: " APP_PORT
                            else
                                break
                            fi
                        fi
                    else
                        break
                    fi
                else
                    print_error "Please enter a valid port number (1024-65535)"
                    read -p "App $i - Port number: " APP_PORT
                fi
            done
        fi
    fi
    
    # Store configuration
    APP_NAMES+=("$APP_NAME")
    APP_DOMAINS+=("$APP_DOMAIN")
    APP_PORTS+=("$APP_PORT")
    ASSIGNED_PORTS+=("$APP_PORT")  # Track assigned port
    
    echo ""
    print_success "App $i configured:"
    echo "  Name:   $APP_NAME"
    echo "  Domain: $APP_DOMAIN"
    echo "  Port:   $APP_PORT"
    echo ""
done

# Summary
print_header "Configuration Summary"
echo ""
print_info "Email: $SSL_EMAIL"
print_info "Total Apps: $NUM_APPS"
echo ""
for ((i=0; i<NUM_APPS; i++)); do
    echo "App $((i+1)): ${APP_NAMES[$i]}"
    echo "  └─ https://${APP_DOMAINS[$i]} → localhost:${APP_PORTS[$i]}"
done
echo ""

read -p "Proceed with this configuration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Setup cancelled"
    exit 1
fi

# Create output directory
mkdir -p nginx-configs
mkdir -p ssl-commands

print_header "Generating Nginx Configurations"

# Generate Nginx config for each app
for ((i=0; i<NUM_APPS; i++)); do
    APP_NAME="${APP_NAMES[$i]}"
    APP_DOMAIN="${APP_DOMAINS[$i]}"
    APP_PORT="${APP_PORTS[$i]}"
    
    CONFIG_FILE="nginx-configs/${APP_NAME}.conf"
    
    print_info "Generating config for $APP_NAME..."
    
    cat > "$CONFIG_FILE" << EOF
# ${APP_NAME} - Nginx Configuration
# Domain: ${APP_DOMAIN}
# Port: ${APP_PORT}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${APP_DOMAIN};

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
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

    # SSL certificate paths
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

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to backend
    location / {
        proxy_pass http://${APP_NAME}-app:5000;
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

    # Logging
    access_log /var/log/nginx/${APP_NAME}-access.log;
    error_log /var/log/nginx/${APP_NAME}-error.log;
}
EOF
    
    print_success "Generated: $CONFIG_FILE"
done

print_header "Generating SSL Certificate Commands"

# Generate SSL commands script
SSL_SCRIPT="ssl-commands/get-all-certificates.sh"
cat > "$SSL_SCRIPT" << 'EOF'
#!/bin/bash
# SSL Certificate Generation Script
# Run this to get SSL certificates for all apps

set -e

echo "================================================"
echo "Getting SSL Certificates for All Apps"
echo "================================================"
echo ""
echo "This will temporarily stop Nginx to obtain certificates"
echo "using standalone mode (about 30 seconds downtime per domain)."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 1
fi

# Robust Nginx container detection (public ports 80/443)
echo "Detecting Nginx container..."
NGINX_CONTAINER=""
ALL_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null)

for CONTAINER in $ALL_CONTAINERS; do
    # Check if container has public port 80 or 443 binding
    PORT_BINDINGS=$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}' 2>/dev/null)
    
    if echo "$PORT_BINDINGS" | grep -qE '"(80|443)/tcp".*"HostIp":"(0\.0\.0\.0|::)"'; then
        # Check if it's nginx or proxy related
        IMAGE=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
        
        if echo "$CONTAINER $IMAGE" | grep -iqE "(nginx|proxy)"; then
            NGINX_CONTAINER="$CONTAINER"
            break
        fi
    fi
done

if [ -z "$NGINX_CONTAINER" ]; then
    echo "Error: Could not find nginx container with public ports 80/443"
    echo "Make sure your Nginx container is running with ports exposed:"
    echo "  docker run -p 80:80 -p 443:443 ..."
    exit 1
fi

echo "Found Nginx container: $NGINX_CONTAINER"
echo ""

EOF

# Add certbot commands for each domain
for ((i=0; i<NUM_APPS; i++)); do
    APP_NAME="${APP_NAMES[$i]}"
    APP_DOMAIN="${APP_DOMAINS[$i]}"
    
    cat >> "$SSL_SCRIPT" << EOF
echo "Getting certificate for ${APP_DOMAIN}..."
docker stop \$NGINX_CONTAINER
certbot certonly --standalone -d ${APP_DOMAIN} -m ${SSL_EMAIL} --agree-tos
docker start \$NGINX_CONTAINER
echo "✓ Certificate obtained for ${APP_DOMAIN}"
echo ""

EOF
done

cat >> "$SSL_SCRIPT" << 'EOF'
echo "================================================"
echo "All SSL Certificates Obtained!"
echo "================================================"
EOF

chmod +x "$SSL_SCRIPT"
print_success "Generated: $SSL_SCRIPT"

# Generate installation script
print_header "Generating Installation Script"

INSTALL_SCRIPT="install-to-nginx.sh"
cat > "$INSTALL_SCRIPT" << 'EOF'
#!/bin/bash
# Install all Nginx configs to Docker container

set -e

echo "================================================"
echo "Installing Nginx Configurations"
echo "================================================"
echo ""

# Robust Nginx container detection (public ports 80/443)
echo "Detecting Nginx container..."
NGINX_CONTAINER=""
ALL_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null)

for CONTAINER in $ALL_CONTAINERS; do
    # Check if container has public port 80 or 443 binding
    PORT_BINDINGS=$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}' 2>/dev/null)
    
    if echo "$PORT_BINDINGS" | grep -qE '"(80|443)/tcp".*"HostIp":"(0\.0\.0\.0|::)"'; then
        # Check if it's nginx or proxy related
        IMAGE=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
        
        if echo "$CONTAINER $IMAGE" | grep -iqE "(nginx|proxy)"; then
            NGINX_CONTAINER="$CONTAINER"
            break
        fi
    fi
done

if [ -z "$NGINX_CONTAINER" ]; then
    echo "Error: Could not find nginx container with public ports 80/443"
    echo "Make sure your Nginx container is running with ports exposed:"
    echo "  docker run -p 80:80 -p 443:443 ..."
    exit 1
fi

echo "Found Nginx container: $NGINX_CONTAINER"
echo ""

EOF

# Add copy commands for each config
for ((i=0; i<NUM_APPS; i++)); do
    APP_NAME="${APP_NAMES[$i]}"
    
    cat >> "$INSTALL_SCRIPT" << EOF
echo "Installing ${APP_NAME} config..."
docker cp nginx-configs/${APP_NAME}.conf \$NGINX_CONTAINER:/etc/nginx/conf.d/${APP_NAME}.conf

EOF
done

cat >> "$INSTALL_SCRIPT" << 'EOF'
echo ""
echo "Testing Nginx configuration..."
docker exec $NGINX_CONTAINER nginx -t

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Configuration valid, restarting Nginx..."
    docker restart $NGINX_CONTAINER
    echo ""
    echo "================================================"
    echo "All configurations installed successfully!"
    echo "================================================"
else
    echo ""
    echo "✗ Configuration test failed!"
    echo "Please check the configs and try again"
    exit 1
fi
EOF

chmod +x "$INSTALL_SCRIPT"
print_success "Generated: $INSTALL_SCRIPT"

# Update .env file for the first app
print_header "Updating Environment Configuration"

# Create .env from .env.example if it doesn't exist
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        print_info "Creating .env file from .env.example..."
        cp .env.example .env
        print_success ".env file created"
    else
        print_error ".env.example not found!"
        print_warning "Please create .env file manually and set:"
        echo "  ENABLE_SSL=existing_nginx"
        echo "  APP_DOMAIN=${APP_DOMAINS[0]}"
    fi
fi

# Update SSL configuration in .env
if [ -f .env ]; then
    print_info "Configuring SSL mode in .env..."
    
    # Update ENABLE_SSL
    if grep -q "^ENABLE_SSL=" .env; then
        sed -i 's/^ENABLE_SSL=.*/ENABLE_SSL=existing_nginx/' .env
    else
        echo "ENABLE_SSL=existing_nginx" >> .env
    fi
    
    # Update APP_DOMAIN to first app's domain
    if grep -q "^APP_DOMAIN=" .env; then
        sed -i "s/^APP_DOMAIN=.*/APP_DOMAIN=${APP_DOMAINS[0]}/" .env
    else
        echo "APP_DOMAIN=${APP_DOMAINS[0]}" >> .env
    fi
    
    # Update APP_HOST_PORT to first app's port
    if grep -q "^APP_HOST_PORT=" .env; then
        sed -i "s/^APP_HOST_PORT=.*/APP_HOST_PORT=${APP_PORTS[0]}/" .env
    else
        echo "APP_HOST_PORT=${APP_PORTS[0]}" >> .env
    fi
    
    print_success "SSL mode configured: existing_nginx"
    print_success "Domain configured: ${APP_DOMAINS[0]}"
    print_success "Port configured: ${APP_PORTS[0]}"
else
    print_error "Failed to update .env file"
fi

echo ""

# Generate summary
print_header "Setup Complete!"
echo ""
print_success "Configuration files generated successfully!"
echo ""
echo "Generated files:"
for ((i=0; i<NUM_APPS; i++)); do
    echo "  ✓ nginx-configs/${APP_NAMES[$i]}.conf"
done
echo "  ✓ $SSL_SCRIPT"
echo "  ✓ $INSTALL_SCRIPT"
echo ""

print_header "Next Steps"
echo ""
echo "1. Make sure all apps are running on their respective ports:"
for ((i=0; i<NUM_APPS; i++)); do
    echo "   - ${APP_NAMES[$i]}: localhost:${APP_PORTS[$i]}"
done
echo ""
echo "2. Get SSL certificates for all domains:"
echo "   ./$SSL_SCRIPT"
echo ""
echo "3. Install configs to your Nginx container:"
echo "   ./$INSTALL_SCRIPT"
echo ""
echo "4. Configure DNS A records for all domains:"
for ((i=0; i<NUM_APPS; i++)); do
    echo "   ${APP_DOMAINS[$i]} → YOUR_SERVER_IP"
done
echo ""
echo "5. Access your applications:"
for ((i=0; i<NUM_APPS; i++)); do
    echo "   https://${APP_DOMAINS[$i]}"
done
echo ""

print_success "Multi-app setup complete! 🎉"
