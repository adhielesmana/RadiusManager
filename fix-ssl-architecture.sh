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

echo "Step 2: Extract mon.maxnetplus.id server block (lines 72-168)"
# Extract the server block content (without the comment line)
SERVER_BLOCK=$(sed -n '72,168p' "$MAIN_CONFIG")
echo -e "${GREEN}✓${NC} Extracted server block"
echo ""

echo "Step 3: Create mon.conf in container"
# Write the server block to mon.conf in the container
echo "$SERVER_BLOCK" | docker exec -i "$NGINX_CONTAINER" sh -c 'cat > /etc/nginx/conf.d/mon.conf'
echo -e "${GREEN}✓${NC} Created /etc/nginx/conf.d/mon.conf"
echo ""

echo "Step 4: Comment out lines 71-168 in main nginx.conf"
# Comment out the entire server block including the comment
sed -i '71,168 s/^/# /' "$MAIN_CONFIG"
echo -e "${GREEN}✓${NC} Commented out mon.maxnetplus.id HTTPS server block"
echo ""

echo "Step 5: Test nginx configuration"
if docker exec "$NGINX_CONTAINER" nginx -t 2>&1; then
    echo -e "${GREEN}✓${NC} Nginx configuration is valid"
else
    echo -e "${RED}✗${NC} Nginx configuration test failed!"
    echo "Restoring backup..."
    LATEST_BACKUP=$(ls -t "$MAIN_CONFIG.backup-"* | head -1)
    cp "$LATEST_BACKUP" "$MAIN_CONFIG"
    docker exec "$NGINX_CONTAINER" rm -f /etc/nginx/conf.d/mon.conf
    exit 1
fi
echo ""

echo "Step 6: Restart nginx container"
docker restart "$NGINX_CONTAINER"
echo "Waiting for nginx to start..."
sleep 3
echo -e "${GREEN}✓${NC} Nginx restarted"
echo ""

echo "Step 7: Verify SSL certificates"
echo ""
echo "Testing mon.maxnetplus.id:"
MON_CERT=$(echo | openssl s_client -servername mon.maxnetplus.id -connect localhost:443 2>/dev/null | openssl x509 -noout -ext subjectAltName 2>/dev/null || echo "Could not retrieve certificate")
echo "$MON_CERT"
echo ""
echo "Testing isp.maxnetplus.id:"
ISP_CERT=$(echo | openssl s_client -servername isp.maxnetplus.id -connect localhost:443 2>/dev/null | openssl x509 -noout -ext subjectAltName 2>/dev/null || echo "Could not retrieve certificate")
echo "$ISP_CERT"
echo ""

# Check if correct
if echo "$ISP_CERT" | grep -q "isp.maxnetplus.id"; then
    echo -e "${GREEN}✓✓✓ SUCCESS! isp.maxnetplus.id is now serving the correct certificate!${NC}"
    echo ""
    echo "Architecture cleanup complete:"
    echo "  ✓ mon.maxnetplus.id moved to /etc/nginx/conf.d/mon.conf"
    echo "  ✓ isp.maxnetplus.id in /etc/nginx/conf.d/isp-manager.conf"
    echo "  ✓ Both domains serving correct SSL certificates"
else
    echo -e "${RED}✗✗✗ WARNING: isp.maxnetplus.id certificate verification failed${NC}"
    echo "The configuration has been updated, but certificate may need time to propagate."
    echo "Try testing again in a few seconds."
fi

echo ""
echo "=================================================="
echo "Done!"
echo "=================================================="
