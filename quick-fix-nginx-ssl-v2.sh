#!/bin/bash
# Quick Fix for nginx SSL Certificate Issue (v2)
# Uses docker exec with running container to avoid stopped container issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Quick Fix: nginx SSL Certificate Issue (v2)${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Detect nginx container
echo -e "${BLUE}1. Detecting nginx container...${NC}"
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

echo -e "${GREEN}✓ Found nginx container: $NGINX_CONTAINER${NC}"
echo ""

# Create temp directory
TEMP_DIR=$(mktemp -d)
echo -e "${BLUE}2. Copying nginx.conf from container...${NC}"

docker cp "$NGINX_CONTAINER":/etc/nginx/nginx.conf "$TEMP_DIR/nginx.conf" 2>/dev/null || {
    echo -e "${RED}✗ Could not copy nginx.conf${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
}

echo -e "${GREEN}✓ Copied to: $TEMP_DIR/nginx.conf${NC}"
echo ""

# Create backup
cp "$TEMP_DIR/nginx.conf" "$TEMP_DIR/nginx.conf.backup"
echo -e "${BLUE}3. Creating backup...${NC}"
echo -e "${GREEN}✓ Backup created${NC}"
echo ""

# Show current SSL lines
echo -e "${BLUE}4. Current global SSL directives:${NC}"
grep -n "ssl_certificate" "$TEMP_DIR/nginx.conf" | grep -v "^[[:space:]]*#" || echo "  (none found)"
echo ""

# Edit the file
echo -e "${BLUE}5. Commenting out global SSL directives...${NC}"
sed -i \
    -e 's|^[[:space:]]*ssl_certificate[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate /etc/nginx/ssl/|' \
    -e 's|^[[:space:]]*ssl_certificate_key[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate_key /etc/nginx/ssl/|' \
    "$TEMP_DIR/nginx.conf" 2>/dev/null || {
    echo -e "${RED}✗ Could not edit nginx.conf${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
}

echo -e "${GREEN}✓ Global SSL directives commented out${NC}"
echo ""

# Show after
echo -e "${BLUE}6. Modified SSL directives:${NC}"
grep -n "ssl_certificate" "$TEMP_DIR/nginx.conf" || echo "  (all commented)"
echo ""

# Create backup inside container first (while running)
echo -e "${BLUE}7. Creating backup inside container...${NC}"
docker exec "$NGINX_CONTAINER" cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup 2>/dev/null || {
    echo -e "${YELLOW}⚠ Could not create backup, but continuing...${NC}"
}
echo ""

# Copy modified config back using docker exec with cat (container stays running)
echo -e "${BLUE}8. Applying modified nginx.conf...${NC}"
cat "$TEMP_DIR/nginx.conf" | docker exec -i "$NGINX_CONTAINER" sh -c 'cat > /etc/nginx/nginx.conf.new && mv /etc/nginx/nginx.conf.new /etc/nginx/nginx.conf' || {
    echo -e "${RED}✗ Could not apply modified config${NC}"
    echo -e "${YELLOW}Attempting to restore backup...${NC}"
    docker exec "$NGINX_CONTAINER" sh -c 'if [ -f /etc/nginx/nginx.conf.backup ]; then cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf; fi' 2>/dev/null || true
    rm -rf "$TEMP_DIR"
    exit 1
}

echo -e "${GREEN}✓ Modified nginx.conf applied${NC}"
echo ""

# Test config
echo -e "${BLUE}9. Testing nginx configuration...${NC}"
if docker exec "$NGINX_CONTAINER" nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration has errors${NC}"
    docker exec "$NGINX_CONTAINER" nginx -t 2>&1
    
    echo ""
    echo -e "${YELLOW}Attempting to rollback...${NC}"
    
    # Restore backup
    docker exec "$NGINX_CONTAINER" sh -c 'if [ -f /etc/nginx/nginx.conf.backup ]; then cp /etc/nginx/nginx.conf.backup /etc/nginx/nginx.conf; fi' 2>/dev/null || {
        echo -e "${RED}✗ Could not restore backup${NC}"
    }
    
    rm -rf "$TEMP_DIR"
    echo -e "${GREEN}✓ Rolled back to original configuration${NC}"
    exit 1
fi
echo ""

# Reload nginx (no restart needed!)
echo -e "${BLUE}10. Reloading nginx...${NC}"
docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null || {
    echo -e "${YELLOW}⚠ Could not reload, restarting instead...${NC}"
    docker restart "$NGINX_CONTAINER" >/dev/null 2>&1
    sleep 3
}
echo -e "${GREEN}✓ Nginx reloaded${NC}"
echo ""

# Cleanup
rm -rf "$TEMP_DIR"

# Test SSL
echo -e "${BLUE}11. Testing SSL certificate...${NC}"
echo ""
sleep 2  # Give nginx a moment to reload
if curl -I https://isp.maxnetplus.id 2>&1 | grep -q "HTTP"; then
    echo -e "${GREEN}✓ SUCCESS! SSL certificate is working correctly${NC}"
    echo ""
    echo "Certificate details:"
    echo | openssl s_client -servername isp.maxnetplus.id -connect localhost:443 2>/dev/null | openssl x509 -noout -text | grep -A1 "Subject Alternative Name" || true
else
    echo -e "${RED}✗ Still getting SSL errors${NC}"
    echo ""
    echo "Error details:"
    curl -I https://isp.maxnetplus.id 2>&1 | head -5
fi
echo ""

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}Fix completed!${NC}"
echo -e "${BLUE}================================================${NC}"
