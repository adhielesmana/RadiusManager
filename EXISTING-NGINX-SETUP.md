# ISP Manager with Existing Nginx - Complete Setup

## 🎯 Your Situation
- Server has existing Nginx on ports 80/443
- Server has other Docker containers running
- You want ISP Manager with HTTPS on your domain

## ✅ Solution: Backend Mode with Existing Nginx

ISP Manager will run on **port 5000** (backend only), and your existing Nginx will proxy to it.

---

## 📋 Step 1: Configure ISP Manager for Existing Nginx

On your server, edit the `.env` file:

```bash
cd ~/RadiusManager
nano .env
```

**Change these lines:**

```bash
# Set to existing_nginx mode
ENABLE_SSL=existing_nginx

# Your domain
APP_DOMAIN=isp.yourcompany.com

# Your email
LETSENCRYPT_EMAIL=admin@yourcompany.com

# Backend will run on port 5000 (or whatever APP_HOST_PORT is)
# APP_HOST_PORT=5000  (leave this as-is, usually 5000 or 5001)
```

Save and exit (Ctrl+X, Y, Enter)

---

## 📋 Step 2: Deploy ISP Manager

```bash
docker compose down
./deploy.sh
```

This will start ISP Manager on port 5000 **without** trying to use ports 80/443.

---

## 📋 Step 3: Add Nginx Configuration

Generate the Nginx config:

```bash
./generate-nginx-config.sh
```

This will create a file with Nginx configuration. Copy it to your Nginx sites:

```bash
# Create new site config
sudo nano /etc/nginx/sites-available/isp-manager

# Paste the generated config from generate-nginx-config.sh
```

**Here's a template config:**

```nginx
# ISP Manager - Nginx Configuration
# Backend running on localhost:5000

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name isp.yourcompany.com;

    # Let's Encrypt ACME challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name isp.yourcompany.com;

    # SSL certificate paths (update with your actual certificate paths)
    ssl_certificate /etc/letsencrypt/live/isp.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/isp.yourcompany.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Proxy to ISP Manager backend
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support (for real-time features)
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Logging
    access_log /var/log/nginx/isp-manager-access.log;
    error_log /var/log/nginx/isp-manager-error.log;
}
```

**Important:** Replace `isp.yourcompany.com` with your actual domain!

---

## 📋 Step 4: Get SSL Certificate (If you don't have one)

If you don't already have an SSL certificate for your domain:

```bash
# Install certbot if not already installed
sudo apt install certbot python3-certbot-nginx

# Get certificate for your domain
sudo certbot --nginx -d isp.yourcompany.com
```

Follow the prompts. Certbot will automatically:
- Get the certificate
- Update your Nginx config with SSL paths
- Set up auto-renewal

---

## 📋 Step 5: Enable Site and Restart Nginx

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/isp-manager /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, restart Nginx
sudo systemctl restart nginx
```

---

## 📋 Step 6: Access Your ISP Manager

Visit: **https://isp.yourcompany.com**

**Default login:**
- Username: `adhielesmana`
- Password: `admin123`

---

## 🔍 Troubleshooting

### **Issue: Nginx test fails**

```bash
sudo nginx -t
```

Check for:
- Syntax errors in the config
- Certificate paths are correct
- Port 5000 is running (check with `docker compose ps`)

### **Issue: 502 Bad Gateway**

ISP Manager backend isn't running:

```bash
# Check if ISP Manager is running
docker compose ps

# Check logs
docker compose logs -f app

# Restart if needed
docker compose restart app
```

### **Issue: Certificate not found**

Your SSL certificate paths might be different. Find them:

```bash
sudo ls -la /etc/letsencrypt/live/
```

Update the paths in your Nginx config.

### **Issue: Can't access from outside**

Check firewall:

```bash
sudo ufw allow 'Nginx Full'
sudo ufw status
```

---

## 📊 Verify Everything is Working

```bash
# Check ISP Manager backend
curl http://localhost:5000

# Check Nginx is proxying
curl https://isp.yourcompany.com

# Check Docker containers
docker compose ps

# Check Nginx status
sudo systemctl status nginx

# Check Nginx logs
sudo tail -f /var/log/nginx/isp-manager-access.log
```

---

## 🔄 Port Summary

| Service | Port | Access |
|---------|------|--------|
| ISP Manager (Backend) | 5000 | Internal only |
| PostgreSQL | 5433 | Internal only |
| FreeRADIUS Auth | 1812 | External (UDP) |
| FreeRADIUS Acct | 1813 | External (UDP) |
| Nginx HTTP | 80 | External → HTTPS redirect |
| Nginx HTTPS | 443 | External → Backend (5000) |

---

## ✅ Summary

1. ✅ Edit `.env`: Set `ENABLE_SSL=existing_nginx` and your domain
2. ✅ Deploy: `./deploy.sh`
3. ✅ Add Nginx config to your existing Nginx
4. ✅ Get SSL certificate with certbot (if needed)
5. ✅ Restart Nginx
6. ✅ Access at `https://isp.yourcompany.com`

**No port conflicts!** ISP Manager uses only port 5000 internally, Nginx proxies from 443 to 5000.

---

**Last Updated:** November 11, 2025  
**Mode:** Existing Nginx Integration  
**Status:** ✅ Production Ready
