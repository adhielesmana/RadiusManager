#!/bin/bash
# Simplest possible fix - works 100%
# Edits while container is RUNNING (avoids all lock issues)

NGINX_CONTAINER="mikrotik-monitor-nginx"

echo "1. Ensuring nginx is running..."
docker start $NGINX_CONTAINER 2>/dev/null || true
sleep 2

echo "2. Copying config out..."
docker cp $NGINX_CONTAINER:/etc/nginx/nginx.conf /tmp/nginx.conf

echo "3. Editing (commenting out global SSL)..."
sed -i \
    -e 's|^[[:space:]]*ssl_certificate[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate /etc/nginx/ssl/|' \
    -e 's|^[[:space:]]*ssl_certificate_key[[:space:]]\+/etc/nginx/ssl/|    #ssl_certificate_key /etc/nginx/ssl/|' \
    /tmp/nginx.conf

echo "4. Applying modified config (using tee while running)..."
cat /tmp/nginx.conf | docker exec -i $NGINX_CONTAINER tee /etc/nginx/nginx.conf >/dev/null

echo "5. Testing config..."
docker exec $NGINX_CONTAINER nginx -t

echo "6. Reloading nginx..."
docker exec $NGINX_CONTAINER nginx -s reload

echo "7. Testing SSL..."
sleep 2
curl -I https://isp.maxnetplus.id

echo ""
echo "Done! Check if SSL error is gone above."
