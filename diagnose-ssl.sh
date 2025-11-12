#!/bin/bash
# SSL Diagnostic Script
# Identifies why isp.maxnetplus.id is getting the wrong certificate

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================================"
echo "SSL Certificate Diagnostic for isp.maxnetplus.id"
echo "================================================"
echo ""

# 1. Check if certificate exists on host
echo -e "${BLUE}1. Checking certificate on host...${NC}"
if [ -f /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem ]; then
    echo -e "${GREEN}✓ Certificate exists on host${NC}"
    echo "Expiry:"
    openssl x509 -enddate -noout -in /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem
    echo "Domain names:"
    openssl x509 -text -noout -in /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem | grep -A1 "Subject Alternative Name"
else
    echo -e "${RED}✗ Certificate NOT found on host${NC}"
    echo "Location: /etc/letsencrypt/live/isp.maxnetplus.id/"
fi
echo ""

# 2. Detect nginx container
echo -e "${BLUE}2. Detecting nginx container...${NC}"
NGINX_CONTAINER=""
ALL_CONTAINERS=$(docker ps --format "{{.Names}}" 2>/dev/null)

for CONTAINER in $ALL_CONTAINERS; do
    PORT_BINDINGS=$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}' 2>/dev/null)
    
    if echo "$PORT_BINDINGS" | grep -qE '"(80|443)/tcp".*"HostIp":"(0\.0\.0\.0|::)"'; then
        IMAGE=$(docker inspect "$CONTAINER" --format '{{.Config.Image}}' 2>/dev/null)
        
        if echo "$CONTAINER $IMAGE" | grep -iqE "(nginx|proxy)"; then
            NGINX_CONTAINER="$CONTAINER"
            break
        fi
    fi
done

if [ -z "$NGINX_CONTAINER" ]; then
    echo -e "${RED}✗ No nginx container found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Nginx container: $NGINX_CONTAINER${NC}"
echo ""

# 3. Check if certificate exists in container
echo -e "${BLUE}3. Checking certificate in nginx container...${NC}"
if docker exec "$NGINX_CONTAINER" test -f /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem 2>/dev/null; then
    echo -e "${GREEN}✓ Certificate exists in container${NC}"
else
    echo -e "${RED}✗ Certificate NOT in container${NC}"
    echo "Need to copy: docker cp /etc/letsencrypt $NGINX_CONTAINER:/etc/"
fi
echo ""

# 4. Check nginx.conf for global SSL
echo -e "${BLUE}4. Checking nginx.conf for global SSL directives...${NC}"
docker exec "$NGINX_CONTAINER" grep -n "ssl_certificate" /etc/nginx/nginx.conf 2>/dev/null | while read line; do
    if echo "$line" | grep -q "^[^#]*ssl_certificate"; then
        # Not commented
        echo -e "${RED}✗ ACTIVE global SSL: $line${NC}"
    else
        # Commented
        echo -e "${GREEN}✓ Commented: $line${NC}"
    fi
done
echo ""

# 5. Check if isp.maxnetplus.id config exists
echo -e "${BLUE}5. Checking nginx config for isp.maxnetplus.id...${NC}"
if docker exec "$NGINX_CONTAINER" test -f /etc/nginx/conf.d/isp-manager.conf 2>/dev/null; then
    echo -e "${GREEN}✓ Config file exists: /etc/nginx/conf.d/isp-manager.conf${NC}"
    
    # Check SSL certificate path in config
    docker exec "$NGINX_CONTAINER" grep "ssl_certificate" /etc/nginx/conf.d/isp-manager.conf 2>/dev/null | grep -v "ssl_certificate_key" | while read line; do
        echo "  Certificate: $line"
    done
else
    echo -e "${RED}✗ Config file NOT found${NC}"
    echo "Expected: /etc/nginx/conf.d/isp-manager.conf"
    echo ""
    echo "Available configs:"
    docker exec "$NGINX_CONTAINER" ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "  (directory not accessible)"
fi
echo ""

# 6. Check what certificate is actually being served
echo -e "${BLUE}6. Checking actual certificate being served...${NC}"
echo | openssl s_client -servername isp.maxnetplus.id -connect localhost:443 2>/dev/null | openssl x509 -noout -text | grep -A1 "Subject Alternative Name" || echo "Could not retrieve certificate"
echo ""

# 7. Test nginx config
echo -e "${BLUE}7. Testing nginx configuration...${NC}"
if docker exec "$NGINX_CONTAINER" nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Nginx config is valid${NC}"
else
    echo -e "${RED}✗ Nginx config has errors:${NC}"
    docker exec "$NGINX_CONTAINER" nginx -t 2>&1
fi
echo ""

# Summary and recommendations
echo "================================================"
echo "SUMMARY & RECOMMENDED ACTIONS"
echo "================================================"
echo ""

# Check what needs to be done
NEEDS_CERT_COPY=false
NEEDS_NGINX_FIX=false
NEEDS_CONFIG_INSTALL=false
NEEDS_RELOAD=false

if ! docker exec "$NGINX_CONTAINER" test -f /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem 2>/dev/null; then
    NEEDS_CERT_COPY=true
fi

if docker exec "$NGINX_CONTAINER" grep "^[^#]*ssl_certificate[^_]" /etc/nginx/nginx.conf 2>/dev/null | grep -q "/etc/nginx/ssl/"; then
    NEEDS_NGINX_FIX=true
fi

if ! docker exec "$NGINX_CONTAINER" test -f /etc/nginx/conf.d/isp-manager.conf 2>/dev/null; then
    NEEDS_CONFIG_INSTALL=true
fi

# Display recommendations
if [ "$NEEDS_CERT_COPY" = true ]; then
    echo -e "${YELLOW}ACTION NEEDED: Copy certificates to nginx container${NC}"
    echo "  docker stop $NGINX_CONTAINER"
    echo "  docker cp /etc/letsencrypt $NGINX_CONTAINER:/etc/"
    echo "  docker start $NGINX_CONTAINER"
    echo ""
fi

if [ "$NEEDS_NGINX_FIX" = true ]; then
    echo -e "${YELLOW}ACTION NEEDED: Fix nginx.conf (comment out global SSL)${NC}"
    echo "  The deploy.sh script should handle this automatically"
    echo "  Or manually edit and comment out ssl_certificate lines in http block"
    echo ""
fi

if [ "$NEEDS_CONFIG_INSTALL" = true ]; then
    echo -e "${YELLOW}ACTION NEEDED: Install nginx config for isp.maxnetplus.id${NC}"
    echo "  Run: ./install-to-nginx.sh"
    echo "  Or manually: docker cp nginx-configs/isp-manager.conf $NGINX_CONTAINER:/etc/nginx/conf.d/"
    echo ""
fi

if [ "$NEEDS_CERT_COPY" = true ] || [ "$NEEDS_NGINX_FIX" = true ] || [ "$NEEDS_CONFIG_INSTALL" = true ]; then
    echo -e "${YELLOW}After fixes, reload nginx:${NC}"
    echo "  docker exec $NGINX_CONTAINER nginx -s reload"
    echo ""
    
    echo -e "${BLUE}OR simply run the updated deploy.sh script:${NC}"
    echo "  ./deploy.sh --skip-build"
    echo ""
else
    echo -e "${GREEN}✓ Everything looks correct!${NC}"
    echo ""
    echo "If still getting errors, try:"
    echo "  docker exec $NGINX_CONTAINER nginx -s reload"
    echo ""
fi
