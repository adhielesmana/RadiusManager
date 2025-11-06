#!/bin/bash
set -e

echo "========================================"
echo "ISP Manager - Nginx SSL Proxy Starting"
echo "========================================"

# Environment variables
DOMAIN="${APP_DOMAIN}"
EMAIL="${LETSENCRYPT_EMAIL}"
STAGING="${LE_STAGING:-false}"

echo "Domain: ${DOMAIN}"
echo "Email: ${EMAIL}"
echo "Let's Encrypt Staging: ${STAGING}"

# Wait for app to be ready
echo ""
echo "Waiting for ISP Manager application to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s -o /dev/null -w "%{http_code}" http://app:5000 | grep -q "200\|302"; then
        echo "✓ ISP Manager application is ready"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo -n "."
    sleep 2
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⚠ Warning: ISP Manager application may not be fully ready"
fi

# Process nginx configuration templates
echo ""
echo "Configuring Nginx..."
envsubst '${APP_DOMAIN}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
envsubst '${APP_DOMAIN}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
echo "✓ Nginx configuration generated"

# Check if certificates already exist
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ ! -f "$CERT_PATH" ]; then
    echo ""
    echo "========================================"
    echo "Obtaining SSL Certificate"
    echo "========================================"
    
    # Start nginx in background to serve ACME challenges
    echo "Starting Nginx for ACME challenge..."
    nginx -g "daemon off;" &
    NGINX_PID=$!
    sleep 3
    
    # Prepare certbot command
    CERTBOT_ARGS="certonly --webroot -w /var/www/certbot \
        --email ${EMAIL} \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        -d ${DOMAIN}"
    
    if [ "$STAGING" = "true" ]; then
        echo "Using Let's Encrypt STAGING server (for testing)"
        CERTBOT_ARGS="${CERTBOT_ARGS} --staging"
    fi
    
    # Obtain certificate
    echo "Requesting certificate from Let's Encrypt..."
    echo "Domain: ${DOMAIN}"
    echo ""
    
    if certbot $CERTBOT_ARGS; then
        echo ""
        echo "✓ SSL certificate obtained successfully!"
        
        # Stop background nginx
        kill $NGINX_PID
        wait $NGINX_PID 2>/dev/null || true
        sleep 2
    else
        echo ""
        echo "✗ Failed to obtain SSL certificate"
        echo ""
        echo "Please verify:"
        echo "  1. DNS records point to this server"
        echo "  2. Ports 80 and 443 are accessible from the internet"
        echo "  3. Domain name is correct: ${DOMAIN}"
        echo "  4. Email is valid: ${EMAIL}"
        echo ""
        echo "Starting Nginx without SSL..."
        
        # Stop background nginx first
        kill $NGINX_PID
        wait $NGINX_PID 2>/dev/null || true
        sleep 2
        
        # Create a basic HTTP-only config as fallback
        cat > /etc/nginx/conf.d/default.conf <<EOF
upstream app_backend {
    server app:5000;
}

server {
    listen 80;
    server_name ${DOMAIN};
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        proxy_pass http://app_backend;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    fi
else
    echo ""
    echo "✓ SSL certificate already exists for ${DOMAIN}"
    
    # Check certificate expiry
    EXPIRY_DATE=$(openssl x509 -enddate -noout -in "$CERT_PATH" | cut -d= -f2)
    echo "Certificate expires: ${EXPIRY_DATE}"
fi

# Start cron for automatic certificate renewal
echo ""
echo "Starting certificate renewal cron job..."
crond -l 2 -f &
CRON_PID=$!
echo "✓ Cron started (PID: $CRON_PID)"

echo ""
echo "========================================"
echo "Starting Nginx"
echo "========================================"

# Execute the main command (start nginx)
exec "$@"
