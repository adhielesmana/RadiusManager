#!/bin/bash
set -e

# =============================================================================
# ISP Manager - Enhanced Setup Script
# Installs nginx, certbot, Docker, configures nginx sites with SSL,
# and handles database schema creation/updates
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

# Find available port intelligently
find_available_port() {
    local base_port=5000
    local max_port=5100
    local port=$base_port
    
    print_info "Scanning for available ports ($base_port-$max_port)..." >&2
    
    # Create port conflict matrix
    local used_ports=()
    while [ $port -le $max_port ]; do
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            used_ports+=($port)
            ((port++))
        else
            # Found available port
            print_success "Found available port: $port" >&2
            
            # Log conflict matrix if any ports were in use
            if [ ${#used_ports[@]} -gt 0 ]; then
                print_info "Ports already in use: ${used_ports[*]}" >&2
            fi
            
            echo "$port"
            return 0
        fi
    done
    
    print_error "No available ports in range $base_port-$max_port" >&2
    print_error "Used ports: ${used_ports[*]}" >&2
    exit 1
}

# Update .env key (create if missing, update if exists)
update_env_key() {
    local key="$1"
    local value="$2"
    local env_file=".env"
    
    if grep -q "^${key}=" "$env_file" 2>/dev/null; then
        # Key exists, remove old line and append new one
        grep -v "^${key}=" "$env_file" > "$env_file.tmp"
        echo "${key}=${value}" >> "$env_file.tmp"
        mv "$env_file.tmp" "$env_file"
    else
        # Key doesn't exist, append it
        echo "${key}=${value}" >> "$env_file"
    fi
}

# Generate production-ready nginx site configuration
generate_nginx_config() {
    local domain="$1"
    local port="$2"
    local config_file="/etc/nginx/sites-available/$domain"
    local ssl_ready="$3"  # "true" if SSL is ready, "false" otherwise
    
    if [ "$ssl_ready" = "true" ] && [ -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]; then
        # Generate configuration with HTTPS redirect and hardened SSL
        cat > "$config_file" << EOF
# ISP Manager - $domain (HTTPS Enabled)

# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name $domain;
    
    # Allow certbot challenges
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other HTTP to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server - production hardened
server {
    listen 443 ssl http2;
    server_name $domain;
    
    # SSL Certificate
    ssl_certificate /etc/letsencrypt/live/$domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$domain/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/$domain/chain.pem;
    
    # SSL Security - Modern Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    
    # Reverse Proxy Configuration
    location / {
        proxy_pass http://localhost:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
    else
        # Generate HTTP-only configuration (for initial setup)
        cat > "$config_file" << EOF
# ISP Manager - $domain (HTTP Only - SSL Pending)
server {
    listen 80;
    server_name $domain;
    
    # Allow certbot challenges
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Proxy to application
    location / {
        proxy_pass http://localhost:$port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
    fi
    
    print_success "Created nginx config: $config_file"
}

# Setup SSL with certbot
setup_ssl() {
    local domain="$1"
    local email="$2"
    
    print_info "Setting up SSL certificate for $domain..."
    
    # Try certbot with dry-run first
    if certbot --nginx -d "$domain" --non-interactive --agree-tos --email "$email" --dry-run >/dev/null 2>&1; then
        # Actual certificate issuance
        if certbot --nginx -d "$domain" --non-interactive --agree-tos --email "$email" --redirect; then
            print_success "SSL certificate obtained and configured"
            return 0
        else
            print_warning "SSL certificate issuance failed"
            return 1
        fi
    else
        print_warning "SSL dry-run failed - domain may not be pointing to this server yet"
        print_info "SSL will use HTTP-only until domain DNS is configured"
        print_info "Run 'certbot --nginx -d $domain' manually after DNS propagation"
        return 1
    fi
}

# Check if nginx site config exists for domain
check_nginx_config_exists() {
    local domain="$1"
    
    if [ -f "/etc/nginx/sites-enabled/$domain" ] || [ -f "/etc/nginx/sites-available/$domain" ]; then
        return 0
    fi
    
    # Also check if domain is configured in any other config file
    if grep -r "server_name.*$domain" /etc/nginx/sites-enabled/ 2>/dev/null | grep -q "$domain"; then
        return 0
    fi
    
    return 1
}

main() {
    # Parse arguments
    APP_DOMAIN=""
    APP_EMAIL=""
    AUTO_MODE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain) APP_DOMAIN="$2"; shift 2 ;;
            --email) APP_EMAIL="$2"; shift 2 ;;
            --auto) AUTO_MODE=true; shift ;;
            --help)
                echo "Usage: sudo ./setup.sh [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --domain DOMAIN    Set domain name"
                echo "  --email EMAIL      Set email for SSL"
                echo "  --auto             Non-interactive mode (for deploy.sh)"
                echo ""
                echo "Example: sudo ./setup.sh --domain isp.example.com --email admin@example.com"
                exit 0
                ;;
            *) print_error "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    # Only clear screen if not in auto mode
    if [ "$AUTO_MODE" = false ]; then
        clear
    fi
    
    print_header "ISP Manager - Enhanced Setup"
    
    # Check if we have permission to install packages
    if [ "$EUID" -ne 0 ]; then
        print_error "This script must be run as root"
        print_info "Please run: sudo ./setup.sh"
        exit 1
    fi
    
    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        print_error "Cannot detect OS"
        exit 1
    fi
    
    # =========================================================================
    # Step 1: Nginx Setup
    # =========================================================================
    print_header "Step 1/6: Nginx Setup"
    if command_exists nginx; then
        print_success "Nginx already installed"
        systemctl is-active --quiet nginx || systemctl start nginx
    else
        print_info "Installing nginx..."
        case "$OS" in
            ubuntu|debian)
                apt-get update -qq
                apt-get install -y nginx
                ;;
            centos|rhel|rocky|almalinux)
                yum install -y epel-release nginx
                ;;
            fedora)
                dnf install -y nginx
                ;;
            *)
                print_error "Unsupported OS: $OS"
                exit 1
                ;;
        esac
        
        systemctl enable nginx
        systemctl start nginx
        mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /var/www/html
        
        if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
            sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
        fi
        
        systemctl reload nginx
        print_success "Nginx installed"
    fi
    
    # =========================================================================
    # Step 2: Certbot Setup
    # =========================================================================
    print_header "Step 2/6: Certbot Setup"
    
    CERTBOT_NGINX_INSTALLED=false
    
    if command_exists certbot; then
        print_success "Certbot is installed"
        if certbot plugins 2>/dev/null | grep -q "nginx"; then
            print_success "Certbot nginx plugin is installed"
            CERTBOT_NGINX_INSTALLED=true
        else
            print_warning "Certbot nginx plugin is missing"
        fi
    else
        print_info "Certbot not found"
    fi
    
    if [ "$CERTBOT_NGINX_INSTALLED" = false ]; then
        print_info "Installing certbot with nginx plugin..."
        case "$OS" in
            ubuntu|debian)
                apt-get update -qq
                apt-get install -y certbot python3-certbot-nginx
                ;;
            centos|rhel|rocky|almalinux)
                yum install -y certbot python3-certbot-nginx
                ;;
            fedora)
                dnf install -y certbot python3-certbot-nginx
                ;;
        esac
        
        if certbot plugins 2>/dev/null | grep -q "nginx"; then
            print_success "Certbot with nginx plugin installed successfully"
        else
            print_error "Failed to install certbot nginx plugin"
            exit 1
        fi
    fi
    
    # =========================================================================
    # Step 3: Docker Setup
    # =========================================================================
    print_header "Step 3/6: Docker Setup"
    if command_exists docker && docker info >/dev/null 2>&1; then
        print_success "Docker already installed"
    else
        print_info "Installing Docker..."
        case "$OS" in
            ubuntu|debian)
                apt-get install -y docker.io docker-compose-plugin
                ;;
            centos|rhel|rocky|almalinux|fedora)
                yum install -y docker docker-compose-plugin
                ;;
        esac
        
        systemctl enable docker
        systemctl start docker
        print_success "Docker installed"
    fi
    
    # =========================================================================
    # Step 4: Environment Configuration
    # =========================================================================
    print_header "Step 4/6: Environment Configuration"
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_success "Created .env file"
        else
            print_error ".env.example not found"
            exit 1
        fi
    fi
    
    # Set deployment mode using helper function
    update_env_key "DEPLOYMENT_MODE" "host_nginx"
    update_env_key "USE_DOCKER_COMPOSE_SSL" "false"
    
    # Find available port intelligently
    APP_PORT=$(find_available_port)
    update_env_key "APP_HOST_PORT" "$APP_PORT"
    
    # Set domain and email
    if [ -n "$APP_DOMAIN" ]; then
        update_env_key "APP_DOMAIN" "$APP_DOMAIN"
    else
        # Try to read from existing .env
        APP_DOMAIN=$(grep "^APP_DOMAIN=" .env | cut -d'=' -f2 || echo "")
    fi
    
    if [ -n "$APP_EMAIL" ]; then
        update_env_key "LETSENCRYPT_EMAIL" "$APP_EMAIL"
    else
        # Try to read from existing .env
        APP_EMAIL=$(grep "^LETSENCRYPT_EMAIL=" .env | cut -d'=' -f2 || echo "")
    fi
    
    # Set ENABLE_SSL based on whether we have domain+email (will be updated later based on SSL success)
    if [ -n "$APP_DOMAIN" ] && [ -n "$APP_EMAIL" ]; then
        # Tentatively enable SSL (will be confirmed after SSL setup)
        update_env_key "ENABLE_SSL" "true"
    else
        # No domain or email - definitely HTTP-only
        update_env_key "ENABLE_SSL" "false"
    fi
    
    # Ensure FreeRADIUS configuration exists
    update_env_key "RADIUS_HOST" "freeradius"
    update_env_key "RADIUS_AUTH_PORT" "1812"
    update_env_key "RADIUS_ACCT_PORT" "1813"
    
    print_success "Environment configured"
    
    # =========================================================================
    # Step 5: Nginx Site Configuration & SSL
    # =========================================================================
    print_header "Step 5/6: Nginx Site & SSL Configuration"
    
    if [ -n "$APP_DOMAIN" ]; then
        # Check if site config exists
        if check_nginx_config_exists "$APP_DOMAIN"; then
            print_info "Nginx config for $APP_DOMAIN already exists"
            
            # Update upstream port if different
            if [ -f "/etc/nginx/sites-available/$APP_DOMAIN" ]; then
                CURRENT_PORT=$(grep "proxy_pass.*localhost:" "/etc/nginx/sites-available/$APP_DOMAIN" | sed -n 's/.*localhost:\([0-9]*\).*/\1/p' | head -1)
                if [ "$CURRENT_PORT" != "$APP_PORT" ]; then
                    print_info "Updating port from $CURRENT_PORT to $APP_PORT"
                    sed -i "s/localhost:$CURRENT_PORT/localhost:$APP_PORT/g" "/etc/nginx/sites-available/$APP_DOMAIN"
                    systemctl reload nginx
                    print_success "Port updated in nginx config"
                fi
            fi
        else
            # Generate new nginx config (HTTP-only initially)
            print_info "Creating nginx site configuration for $APP_DOMAIN..."
            generate_nginx_config "$APP_DOMAIN" "$APP_PORT" "false"
            
            # Enable site
            if [ ! -L "/etc/nginx/sites-enabled/$APP_DOMAIN" ]; then
                ln -s "/etc/nginx/sites-available/$APP_DOMAIN" "/etc/nginx/sites-enabled/$APP_DOMAIN"
                print_success "Site enabled: $APP_DOMAIN"
            fi
            
            # Test nginx config
            if nginx -t 2>/dev/null; then
                systemctl reload nginx
                print_success "Nginx reloaded successfully"
            else
                print_error "Nginx configuration test failed"
                nginx -t
                exit 1
            fi
        fi
        
        # Setup SSL if email provided
        if [ -n "$APP_EMAIL" ]; then
            # Check if SSL already configured
            if [ -f "/etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem" ]; then
                print_success "SSL certificate already exists for $APP_DOMAIN"
                
                # Regenerate config with hardened HTTPS
                generate_nginx_config "$APP_DOMAIN" "$APP_PORT" "true"
                systemctl reload nginx
                
                # Renew if needed
                if certbot renew --dry-run >/dev/null 2>&1; then
                    print_info "SSL certificate is valid"
                fi
            else
                # Attempt SSL setup
                if setup_ssl "$APP_DOMAIN" "$APP_EMAIL"; then
                    # SSL succeeded - regenerate config with hardened HTTPS
                    print_info "Regenerating nginx config with hardened HTTPS..."
                    generate_nginx_config "$APP_DOMAIN" "$APP_PORT" "true"
                    systemctl reload nginx
                    print_success "Hardened HTTPS configuration applied"
                else
                    # SSL failed - update .env to reflect HTTP-only mode
                    print_warning "SSL setup failed - application will run in HTTP-only mode"
                    update_env_key "ENABLE_SSL" "false"
                    print_info "To retry SSL later:"
                    print_info "  1. Ensure DNS points $APP_DOMAIN to this server"
                    print_info "  2. Run: certbot --nginx -d $APP_DOMAIN"
                    print_info "  3. Update ENABLE_SSL=true in .env"
                fi
            fi
        else
            print_warning "No email provided - skipping SSL setup"
            update_env_key "ENABLE_SSL" "false"
            print_info "To setup SSL later, run: certbot --nginx -d $APP_DOMAIN"
        fi
    else
        print_warning "No domain configured - skipping nginx site and SSL setup"
        update_env_key "ENABLE_SSL" "false"
        print_info "Configure domain in .env and re-run setup.sh to enable SSL"
    fi
    
    # =========================================================================
    # Step 6: Database Schema Check
    # =========================================================================
    print_header "Step 6/6: Database Schema Verification"
    
    # This will be handled by deploy.sh using create-missing-tables.sql
    print_info "Database schema will be created/updated during deployment"
    print_info "Using: create-missing-tables.sql (idempotent SQL)"
    
    # Summary
    if [ "$AUTO_MODE" = false ]; then
        print_header "Setup Complete!"
        
        echo ""
        print_success "✓ Nginx installed and running"
        print_success "✓ Certbot installed for SSL"
        print_success "✓ Docker installed"
        print_success "✓ Environment configured"
        if [ -n "$APP_DOMAIN" ]; then
            print_success "✓ Nginx site configured for $APP_DOMAIN"
            if [ -f "/etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem" ]; then
                print_success "✓ SSL certificate active"
            else
                print_info "⚠ SSL pending (configure DNS first)"
            fi
        fi
        echo ""
        
        print_info "Configuration:"
        echo "  • Deployment Mode: Host Nginx"
        echo "  • App Port: $APP_PORT"
        echo "  • FreeRADIUS: Local container"
        [ -n "$APP_DOMAIN" ] && echo "  • Domain: $APP_DOMAIN"
        [ -n "$APP_EMAIL" ] && echo "  • Email: $APP_EMAIL"
        echo ""
        
        print_info "Next step:"
        echo "  Run: ./deploy.sh"
        echo ""
        
        if [ -n "$APP_DOMAIN" ] && [ ! -f "/etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem" ]; then
            print_info "SSL Note:"
            echo "  1. Ensure DNS points $APP_DOMAIN to this server's IP"
            echo "  2. Run: certbot --nginx -d $APP_DOMAIN"
            echo ""
        fi
    fi
}

main "$@"
