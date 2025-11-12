# SSL Certificate Paths Configuration

## ✅ Certificate Location (Standard Let's Encrypt)

### On Host System:
```
/etc/letsencrypt/live/{domain}/fullchain.pem
/etc/letsencrypt/live/{domain}/privkey.pem
```

### Inside Nginx Container (after copy):
```
/etc/letsencrypt/live/{domain}/fullchain.pem
/etc/letsencrypt/live/{domain}/privkey.pem
```

---

## ✅ Nginx Virtual Host Configuration

### Single-App Setup (deploy.sh)
**Location:** Generated in `deploy.sh` → `generate_nginx_config()` function

**Certificate paths configured:**
```nginx
server {
    listen 443 ssl http2;
    server_name isp.maxnetplus.id;
    
    # ✓ CORRECT PATHS
    ssl_certificate /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/isp.maxnetplus.id/privkey.pem;
    
    location / {
        proxy_pass http://isp-manager-app:5000;
        ...
    }
}
```

---

### Multi-App Setup (setup-multi-app.sh)
**Location:** Generated in `setup-multi-app.sh` → Creates `nginx-configs/*.conf` files

**Certificate paths configured:**
```nginx
server {
    listen 443 ssl http2;
    server_name ${APP_DOMAIN};
    
    # ✓ CORRECT PATHS (dynamically generated per app)
    ssl_certificate /etc/letsencrypt/live/${APP_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${APP_DOMAIN}/privkey.pem;
    
    location / {
        proxy_pass http://${APP_NAME}-app:5000;
        ...
    }
}
```

**Example for isp.maxnetplus.id:**
```nginx
ssl_certificate /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/isp.maxnetplus.id/privkey.pem;
```

---

## ✅ Automatic Certificate Management Flow

### 1. Certificate Provisioning (on host)
```bash
# Checks if cert exists at /etc/letsencrypt/live/{domain}/fullchain.pem
# If valid >30 days: SKIP
# If expires <30 days: AUTO-RENEW
# If missing: PROVISION NEW
```

### 2. Certificate Copy (host → container)
```bash
# deploy.sh automatically copies:
docker cp /etc/letsencrypt nginx-container:/etc/
```

### 3. Nginx Config Fix (global SSL removal)
```bash
# Comments out global SSL in nginx.conf:
#ssl_certificate /etc/nginx/ssl/fullchain.pem;      # ← BAD (commented out)
#ssl_certificate_key /etc/nginx/ssl/privkey.pem;    # ← BAD (commented out)

# Preserves per-domain SSL:
ssl_certificate /etc/letsencrypt/live/{domain}/fullchain.pem;      # ✓ GOOD
ssl_certificate_key /etc/letsencrypt/live/{domain}/privkey.pem;    # ✓ GOOD
```

### 4. Nginx Config Installation
```bash
# install-to-nginx.sh copies configs into container:
docker cp nginx-configs/*.conf nginx-container:/etc/nginx/conf.d/
docker exec nginx-container nginx -s reload
```

---

## ✅ Verification Commands

### Check certificate on host:
```bash
ls -la /etc/letsencrypt/live/isp.maxnetplus.id/
openssl x509 -in /etc/letsencrypt/live/isp.maxnetplus.id/fullchain.pem -noout -dates
```

### Check certificate in nginx container:
```bash
docker exec mikrotik-monitor-nginx ls -la /etc/letsencrypt/live/isp.maxnetplus.id/
docker exec mikrotik-monitor-nginx nginx -T | grep ssl_certificate
```

### Test SSL from browser:
```bash
curl -I https://isp.maxnetplus.id
```

---

## 🎯 Summary

**ALL nginx vhost configurations are ALREADY pointing to the CORRECT certificate paths:**

✅ Single-app: `/etc/letsencrypt/live/isp.maxnetplus.id/`
✅ Multi-app: `/etc/letsencrypt/live/{domain}/`
✅ Automatic copy from host to container
✅ Automatic global SSL fix in nginx.conf
✅ Automatic certificate validity checking
✅ Automatic renewal if expiring <30 days

**No manual configuration needed!** 🚀
