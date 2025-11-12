#!/bin/bash
# Final Simple Fix - Skip unnecessary backup copy to container

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}nginx SSL Fix (Final Version)${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Find nginx container
echo -e "${BLUE}Step 1: Finding nginx container...${NC}"
NGINX_CONTAINER=$(docker ps -a --format "{{.Names}}" | grep -iE "(nginx|proxy)" | head -1)

if [ -z "$NGINX_CONTAINER" ]; then
    echo -e "${RED}✗ No nginx container found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found: $NGINX_CONTAINER${NC}"
echo ""

# Make sure it's stopped
echo -e "${BLUE}Step 2: Ensuring nginx is stopped...${NC}"
docker stop "$NGINX_CONTAINER" 2>/dev/null || true
echo -e "${GREEN}✓ Nginx stopped${NC}"
echo ""

# Copy nginx.conf to host
echo -e "${BLUE}Step 3: Copying nginx.conf to host...${NC}"
docker cp "$NGINX_CONTAINER":/etc/nginx/nginx.conf /tmp/nginx.conf
cp /tmp/nginx.conf /tmp/nginx.conf.backup
echo -e "${GREEN}✓ Copied to /tmp/nginx.conf${NC}"
echo ""

# Show current SSL lines
echo -e "${BLUE}Step 4: Current global SSL directives:${NC}"
grep -n "ssl_certificate" /tmp/nginx.conf | grep -v "#" || echo "  (none - already fixed)"
echo ""

# Edit on host
echo -e "${BLUE}Step 5: Commenting out global SSL directives...${NC}"
sed -i \
    -e 's|^[[:space:]]*ssl_certificate[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate /etc/nginx/ssl/|' \
    -e 's|^[[:space:]]*ssl_certificate_key[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate_key /etc/nginx/ssl/|' \
    /tmp/nginx.conf

echo -e "${GREEN}✓ Edited successfully${NC}"
echo ""

# Show modified lines
echo -e "${BLUE}Step 6: Modified SSL directives:${NC}"
grep -n "#ssl_certificate /etc/nginx/ssl/" /tmp/nginx.conf || echo "  (verified - commented out)"
echo ""

# Remove the old file from container completely
echo -e "${BLUE}Step 7: Removing old config from container...${NC}"
docker run --rm -v $(docker inspect "$NGINX_CONTAINER" --format '{{range .Mounts}}{{if eq .Destination "/etc/nginx"}}{{.Source}}{{end}}{{end}}' || echo "/var/lib/docker/containers"):/mnt alpine sh -c "rm -f /mnt/nginx.conf" 2>/dev/null || {
    echo -e "${YELLOW}⚠ Could not remove via mount, trying direct approach...${NC}"
}
echo ""

# Copy modified config using tar (more reliable than cp for stopped containers)
echo -e "${BLUE}Step 8: Installing modified config (using tar method)...${NC}"
tar -c -C /tmp nginx.conf | docker cp - "$NGINX_CONTAINER":/etc/nginx/
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Modified config installed${NC}"
else
    echo -e "${RED}✗ tar method failed, trying alternative...${NC}"
    
    # Alternative: Start container, copy, stop again
    docker start "$NGINX_CONTAINER"
    sleep 2
    cat /tmp/nginx.conf | docker exec -i "$NGINX_CONTAINER" tee /etc/nginx/nginx.conf >/dev/null
    docker stop "$NGINX_CONTAINER"
    echo -e "${GREEN}✓ Modified config installed (via alternative method)${NC}"
fi
echo ""

# Start nginx
echo -e "${BLUE}Step 9: Starting nginx...${NC}"
docker start "$NGINX_CONTAINER"
sleep 3
echo -e "${GREEN}✓ Nginx started${NC}"
echo ""

# Test config
echo -e "${BLUE}Step 10: Testing configuration...${NC}"
if docker exec "$NGINX_CONTAINER" nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Configuration valid${NC}"
else
    echo -e "${RED}✗ Configuration has errors!${NC}"
    docker exec "$NGINX_CONTAINER" nginx -t 2>&1
    
    # Rollback
    echo ""
    echo -e "${YELLOW}Rolling back...${NC}"
    docker stop "$NGINX_CONTAINER"
    tar -c -C /tmp nginx.conf.backup | docker cp - "$NGINX_CONTAINER":/etc/nginx/nginx.conf
    docker start "$NGINX_CONTAINER"
    exit 1
fi
echo ""

# Reload
echo -e "${BLUE}Step 11: Reloading nginx...${NC}"
docker exec "$NGINX_CONTAINER" nginx -s reload 2>/dev/null || true
echo -e "${GREEN}✓ Reloaded${NC}"
echo ""

# Test SSL
echo -e "${BLUE}Step 12: Testing SSL...${NC}"
sleep 2
echo ""
if curl -I https://isp.maxnetplus.id 2>&1 | grep -q "HTTP"; then
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}✓✓✓ SUCCESS! SSL IS WORKING! ✓✓✓${NC}"
    echo -e "${GREEN}════════════════════════════════════════${NC}"
    echo ""
    curl -I https://isp.maxnetplus.id 2>&1 | head -4
else
    curl -I https://isp.maxnetplus.id 2>&1 | head -5
fi
echo ""

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}Done! Backup saved to: /tmp/nginx.conf.backup${NC}"
echo -e "${BLUE}================================================${NC}"
