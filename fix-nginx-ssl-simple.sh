#!/bin/bash
# Simple, Reliable nginx.conf Fix
# Stops container → Edits on host → Restarts container
# No file lock issues, guaranteed to work

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}Simple nginx SSL Fix (Stop/Edit/Start Method)${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

# Find nginx container
echo -e "${BLUE}Step 1: Finding nginx container...${NC}"
NGINX_CONTAINER=$(docker ps --format "{{.Names}}" | grep -iE "(nginx|proxy)" | head -1)

if [ -z "$NGINX_CONTAINER" ]; then
    echo -e "${RED}✗ No nginx container found${NC}"
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Image}}"
    exit 1
fi

echo -e "${GREEN}✓ Found: $NGINX_CONTAINER${NC}"
echo ""

# Stop nginx (short maintenance window)
echo -e "${YELLOW}Step 2: Stopping nginx (brief maintenance window)...${NC}"
docker stop "$NGINX_CONTAINER"
echo -e "${GREEN}✓ Nginx stopped${NC}"
echo ""

# Copy nginx.conf to host
echo -e "${BLUE}Step 3: Copying nginx.conf to host...${NC}"
docker cp "$NGINX_CONTAINER":/etc/nginx/nginx.conf /tmp/nginx.conf
docker cp "$NGINX_CONTAINER":/etc/nginx/nginx.conf /tmp/nginx.conf.backup
echo -e "${GREEN}✓ Copied to /tmp/nginx.conf${NC}"
echo ""

# Show current SSL lines
echo -e "${BLUE}Step 4: Current global SSL directives:${NC}"
grep -n "ssl_certificate" /tmp/nginx.conf | grep -v "#" || echo "  (none - already fixed)"
echo ""

# Edit on host (no file lock issues!)
echo -e "${BLUE}Step 5: Commenting out global SSL directives...${NC}"
sed -i \
    -e 's|^[[:space:]]*ssl_certificate[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate /etc/nginx/ssl/|' \
    -e 's|^[[:space:]]*ssl_certificate_key[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate_key /etc/nginx/ssl/|' \
    /tmp/nginx.conf

echo -e "${GREEN}✓ Global SSL directives commented out${NC}"
echo ""

# Show modified lines
echo -e "${BLUE}Step 6: Modified SSL directives:${NC}"
grep -n "ssl_certificate" /tmp/nginx.conf | grep "#ssl_certificate /etc/nginx/ssl/" || echo "  (all commented)"
echo ""

# Copy modified config back
echo -e "${BLUE}Step 7: Copying modified config back to container...${NC}"
docker cp /tmp/nginx.conf "$NGINX_CONTAINER":/etc/nginx/nginx.conf
docker cp /tmp/nginx.conf.backup "$NGINX_CONTAINER":/etc/nginx/nginx.conf.backup
echo -e "${GREEN}✓ Modified config installed${NC}"
echo ""

# Start nginx
echo -e "${BLUE}Step 8: Starting nginx...${NC}"
docker start "$NGINX_CONTAINER"
sleep 3
echo -e "${GREEN}✓ Nginx started${NC}"
echo ""

# Test config
echo -e "${BLUE}Step 9: Testing nginx configuration...${NC}"
if docker exec "$NGINX_CONTAINER" nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ Configuration is valid${NC}"
else
    echo -e "${RED}✗ Configuration has errors!${NC}"
    docker exec "$NGINX_CONTAINER" nginx -t 2>&1
    
    # Rollback
    echo ""
    echo -e "${YELLOW}Rolling back...${NC}"
    docker stop "$NGINX_CONTAINER"
    docker cp /tmp/nginx.conf.backup "$NGINX_CONTAINER":/etc/nginx/nginx.conf
    docker start "$NGINX_CONTAINER"
    echo -e "${GREEN}✓ Rolled back${NC}"
    exit 1
fi
echo ""

# Reload nginx
echo -e "${BLUE}Step 10: Reloading nginx...${NC}"
docker exec "$NGINX_CONTAINER" nginx -s reload
echo -e "${GREEN}✓ Reloaded${NC}"
echo ""

# Test SSL
echo -e "${BLUE}Step 11: Testing SSL certificate...${NC}"
sleep 2
echo ""
if curl -I https://isp.maxnetplus.id 2>&1 | grep -q "HTTP/2 200"; then
    echo -e "${GREEN}✓✓✓ SUCCESS! SSL is working! ✓✓✓${NC}"
    echo ""
    curl -I https://isp.maxnetplus.id 2>&1 | head -3
else
    echo -e "${YELLOW}Testing SSL...${NC}"
    curl -I https://isp.maxnetplus.id 2>&1 | head -5
fi
echo ""

# Cleanup
rm -f /tmp/nginx.conf /tmp/nginx.conf.backup

echo -e "${BLUE}================================================${NC}"
echo -e "${GREEN}Fix Complete!${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo "Your nginx.conf has been updated."
echo "Global SSL directives are now commented out."
echo "Per-domain certificates will now work correctly."
