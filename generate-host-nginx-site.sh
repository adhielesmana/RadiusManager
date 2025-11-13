#!/bin/bash
set -e

# ISP Manager - Host Nginx Site Configuration Generator
# Generates nginx site config for ISP Manager when using host nginx

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

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root"
    echo ""
    echo "Please run: sudo ./generate-host-nginx-site.sh"
    exit 1
fi

# Load environment variables
if [ ! -f .env ]; then
    print_error ".env file not found!"
    echo "Please run ./setup.sh first"
    exit 1
fi

source .env

if [ -z "$APP_DOMAIN" ]; then
    print_error "APP_DOMAIN not set in .env"
    exit 1
fi

if [ -z "$LETSENCRYPT_EMAIL" ]; then
    print_error "LETSENCRYPT_EMAIL not set in .env"
    echo ""
    echo "This is required for SSL certificate provisioning."
    echo "Please run ./setup.sh to configure it."
    exit 1
fi

if [ -z "$APP_HOST_PORT" ]; then
    APP_HOST_PORT=5000
fi

print_header "Generating Nginx Site Configuration"
echo ""
print_info "Domain: $APP_DOMAIN"
print_info "Backend Port: $APP_HOST_PORT"
echo ""

SITE_CONFIG="/etc/nginx/sites-available/isp-manager"

# Generate nginx site configuration
cat > "$SITE_CONFIG" << EOF
# ISP Manager - Nginx Site Configuration
# Domain: $APP_DOMAIN
# Backend: localhost:$APP_HOST_PORT

# Upstream backend
upstream isp_manager_backend {
    server 127.0.0.1:$APP_HOST_PORT;
    keepalive 32;
}

# HTTP server - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name $APP_DOMAIN;

    # ACME challenge location (for Let's Encrypt)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $APP_DOMAIN;

    # SSL certificate paths (will be populated by certbot)
    ssl_certificate /etc/letsencrypt/live/$APP_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$APP_DOMAIN/privkey.pem;
    
    # SSL configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;
    ssl_session_tickets off;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/$APP_DOMAIN/chain.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size (for file uploads)
    client_max_body_size 100M;

    # Root location
    location / {
        proxy_pass http://isp_manager_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # API endpoints with longer timeouts
    location /api/ {
        proxy_pass http://isp_manager_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Longer timeouts for API calls
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://isp_manager_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Cache static assets
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check endpoint
    location /api/health {
        proxy_pass http://isp_manager_backend;
        access_log off;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

print_success "Site configuration created: $SITE_CONFIG"
echo ""

# Enable the site
if [ -L /etc/nginx/sites-enabled/isp-manager ]; then
    print_info "Site already enabled"
else
    ln -s "$SITE_CONFIG" /etc/nginx/sites-enabled/isp-manager
    print_success "Site enabled"
fi

echo ""

# Test nginx configuration
print_header "Testing Nginx Configuration"
echo ""

if nginx -t 2>&1; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed!"
    echo ""
    echo "Please fix the errors above and try again"
    exit 1
fi

echo ""

# Create certbot directory
mkdir -p /var/www/certbot

# Reload nginx
print_info "Reloading nginx..."
systemctl reload nginx
print_success "Nginx reloaded"

echo ""
print_header "Next: Obtain SSL Certificate"
echo ""
print_info "Run the following command to obtain SSL certificate:"
echo ""
echo "  certbot --nginx -d $APP_DOMAIN --email ${LETSENCRYPT_EMAIL} --agree-tos --non-interactive"
echo ""
print_info "Or use the automated SSL setup in deploy.sh"
echo ""
