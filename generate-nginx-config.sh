#!/bin/bash
set -e

# ISP Manager - Nginx Configuration Generator
# This script generates Nginx configuration for integrating with existing Nginx

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Load .env file
if [ ! -f .env ]; then
    echo "Error: .env file not found"
    echo "Please run ./setup.sh first"
    exit 1
fi

source .env

# Check if in existing nginx mode
if [ "$ENABLE_SSL" != "existing_nginx" ]; then
    echo "Error: This script is only for existing Nginx integration mode"
    echo "Current ENABLE_SSL value: $ENABLE_SSL"
    echo ""
    echo "To use this script:"
    echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
    echo "  2. Choose 'Use existing Nginx' when prompted"
    exit 1
fi

# Check required variables
if [ -z "$APP_DOMAIN" ]; then
    echo "Error: APP_DOMAIN not set in .env"
    exit 1
fi

if [ -z "$LETSENCRYPT_EMAIL" ]; then
    echo "Error: LETSENCRYPT_EMAIL not set in .env"
    exit 1
fi

print_info "Generating Nginx configuration for ISP Manager..."
echo ""
print_info "Domain: $APP_DOMAIN"
print_info "Backend: http://localhost:5000"
echo ""

# Generate the configuration file
CONFIG_FILE="isp-manager-nginx.conf"

cat > "$CONFIG_FILE" <<'EOF'
# ISP Manager - Nginx Configuration
# Add this to your existing Nginx setup

# Upstream backend
upstream isp_manager_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name APP_DOMAIN_PLACEHOLDER;

    # ACME challenge location (for Let's Encrypt)
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name APP_DOMAIN_PLACEHOLDER;

    # SSL certificate paths (adjust these to your actual certificate paths)
    # If using Let's Encrypt with certbot:
    ssl_certificate /etc/letsencrypt/live/APP_DOMAIN_PLACEHOLDER/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/APP_DOMAIN_PLACEHOLDER/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/APP_DOMAIN_PLACEHOLDER/chain.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # OCSP stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy settings
    location / {
        proxy_pass http://isp_manager_backend;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Health check endpoint (optional)
    location /health {
        access_log off;
        proxy_pass http://isp_manager_backend/health;
        proxy_set_header Host $host;
    }

    # Access and error logs
    access_log /var/log/nginx/isp-manager-access.log;
    error_log /var/log/nginx/isp-manager-error.log;
}
EOF

# Replace placeholder with actual domain
sed -i "s/APP_DOMAIN_PLACEHOLDER/$APP_DOMAIN/g" "$CONFIG_FILE"

print_success "Nginx configuration generated: $CONFIG_FILE"
echo ""
print_warning "IMPORTANT: Next Steps"
echo ""
echo "1. If you don't have SSL certificate yet, use certbot webroot mode:"
echo "   mkdir -p /var/www/html/.well-known/acme-challenge"
echo "   certbot certonly --webroot -w /var/www/html -d $APP_DOMAIN -m $LETSENCRYPT_EMAIL --agree-tos"
echo ""
echo "   Or use standalone mode (temporarily stop Nginx on port 80):"
echo "   certbot certonly --standalone -d $APP_DOMAIN -m $LETSENCRYPT_EMAIL --agree-tos"
echo ""
echo "2. Copy the configuration to your Nginx container's config directory"
echo "   (adjust path based on your Docker Nginx setup)"
echo ""
echo "3. Reload your Nginx Docker container to apply changes"
echo ""
echo "6. Make sure ISP Manager is running:"
echo "   docker compose ps"
echo ""
echo "7. Access your application:"
echo "   https://$APP_DOMAIN"
echo ""
print_info "The ISP Manager backend will be accessible at http://localhost:5000"
print_info "Nginx will proxy requests from https://$APP_DOMAIN to the backend"
echo ""

# Show certbot command for reference
print_info "Certificate management commands (for Dockerized Nginx):"
echo ""
echo "  # Obtain certificate (webroot mode - Nginx keeps running):"
echo "  mkdir -p /var/www/html/.well-known/acme-challenge"
echo "  certbot certonly --webroot -w /var/www/html -d $APP_DOMAIN -m $LETSENCRYPT_EMAIL --agree-tos"
echo ""
echo "  # Or standalone mode (stop Nginx port 80 first):"
echo "  certbot certonly --standalone -d $APP_DOMAIN -m $LETSENCRYPT_EMAIL --agree-tos"
echo ""
echo "  # Renew certificates:"
echo "  certbot renew"
echo ""
echo "  # List certificates:"
echo "  certbot certificates"
echo ""

print_success "Configuration generation complete!"
