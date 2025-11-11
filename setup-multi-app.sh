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
while true; do
    read -p "Enter your email for SSL certificates: " SSL_EMAIL
    if [ -n "$SSL_EMAIL" ]; then
        break
    fi
    print_error "Email cannot be empty"
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

# Find nginx container
NGINX_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i nginx | head -n 1)
if [ -z "$NGINX_CONTAINER" ]; then
    echo "Error: Could not find nginx container"
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

# Find nginx container
NGINX_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i nginx | head -n 1)
if [ -z "$NGINX_CONTAINER" ]; then
    echo "Error: Could not find nginx container"
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
