#!/bin/bash
set -euo pipefail

echo "=================================================="
echo "🏗️  Fix SSL Architecture - Move mon.maxnetplus.id to conf.d"
echo "=================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NGINX_CONTAINER="mikrotik-monitor-nginx"
MAIN_CONFIG="/root/MikroTikMon/nginx.conf"

echo "Step 1: Backup original nginx.conf"
cp "$MAIN_CONFIG" "$MAIN_CONFIG.backup-$(date +%Y%m%d-%H%M%S)"
echo -e "${GREEN}✓${NC} Backup created"
echo ""

echo "Step 2: Create mon.conf in container"
docker exec "$NGINX_CONTAINER" sh -c 'cat > /etc/nginx/conf.d/mon.conf << '\''EOF'\''
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mon.maxnetplus.id;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers '\''ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384'\'';
    ssl_prefer_server_ciphers off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Root location
    location / {
        limit_req zone=general burst=20 nodelay;
        
        proxy_pass http://mikrotik_app;
        proxy_http_version 1.1;
        
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Buffering
        proxy_buffering off;
    }
}
EOF'
echo -e "${GREEN}✓${NC} Created /etc/nginx/conf.d/mon.conf"
echo ""

echo "Step 3: Comment out lines 72-120 in main nginx.conf"
# Use sed to comment out the server block
sed -i '72,120 s/^/# /' "$MAIN_CONFIG"
echo -e "${GREEN}✓${NC} Commented out mon.maxnetplus.id HTTPS server block"
echo ""

echo "Step 4: Test nginx configuration"
if docker exec "$NGINX_CONTAINER" nginx -t 2>&1; then
    echo -e "${GREEN}✓${NC} Nginx configuration is valid"
else
    echo -e "${RED}✗${NC} Nginx configuration test failed!"
    echo "Restoring backup..."
    cp "$MAIN_CONFIG.backup-"* "$MAIN_CONFIG"
    exit 1
fi
echo ""

echo "Step 5: Restart nginx container"
docker restart "$NGINX_CONTAINER"
echo "Waiting for nginx to start..."
sleep 3
echo -e "${GREEN}✓${NC} Nginx restarted"
echo ""

echo "Step 6: Verify SSL certificates"
echo ""
echo "Testing mon.maxnetplus.id:"
MON_CERT=$(echo | openssl s_client -servername mon.maxnetplus.id -connect localhost:443 2>/dev/null | openssl x509 -noout -ext subjectAltName)
echo "$MON_CERT"
echo ""
echo "Testing isp.maxnetplus.id:"
ISP_CERT=$(echo | openssl s_client -servername isp.maxnetplus.id -connect localhost:443 2>/dev/null | openssl x509 -noout -ext subjectAltName)
echo "$ISP_CERT"
echo ""

# Check if correct
if echo "$ISP_CERT" | grep -q "isp.maxnetplus.id"; then
    echo -e "${GREEN}✓✓✓ SUCCESS! isp.maxnetplus.id is now serving the correct certificate!${NC}"
else
    echo -e "${RED}✗✗✗ FAILED! isp.maxnetplus.id is still serving the wrong certificate${NC}"
fi

echo ""
echo "=================================================="
echo "Done! Architecture cleanup complete."
echo "=================================================="
