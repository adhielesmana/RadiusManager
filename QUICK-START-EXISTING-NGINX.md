# Quick Start - ISP Manager with Existing Nginx

## ✅ Automatic Detection & Configuration!

The setup script now **automatically detects** your existing Nginx and configures everything for you - **no manual editing required**!

---

## 🚀 One Command Setup

On your server, run:

```bash
./setup.sh --domain isp.yourcompany.com --email admin@yourcompany.com --existing-nginx
```

**That's it!** The script will:
- ✅ Detect your existing Nginx automatically
- ✅ Configure ISP Manager to run on port 5000 (backend)
- ✅ Set `ENABLE_SSL=existing_nginx` in .env automatically
- ✅ Set your domain and email automatically
- ✅ Resolve all port conflicts automatically

Then deploy:

```bash
./deploy.sh
```

---

## 📋 Next Steps (After Deploy)

After `./deploy.sh` completes, just run:

```bash
./generate-nginx-config.sh
```

This will generate the exact Nginx configuration you need. Then:

```bash
# Copy the config
sudo nano /etc/nginx/sites-available/isp-manager

# Paste the generated config

# Enable it
sudo ln -s /etc/nginx/sites-available/isp-manager /etc/nginx/sites-enabled/

# Test
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Done! Access at: **https://isp.yourcompany.com**

---

## 🎯 Alternative: Interactive Mode

If you prefer, just run:

```bash
./setup.sh
```

It will:
1. Ask if you want to enable SSL/HTTPS (answer: **y**)
2. **Automatically detect** your existing Nginx
3. Ask if you want to use it (answer: **y**)
4. Ask for your domain
5. Ask for your email
6. Configure everything automatically!

---

## ✅ What Gets Configured Automatically

```bash
# .env file (no manual editing needed!)
ENABLE_SSL=existing_nginx
APP_DOMAIN=isp.yourcompany.com
LETSENCRYPT_EMAIL=admin@yourcompany.com
APP_HOST_PORT=5000
```

---

## 🔍 Verify Detection

The setup will show:

```
================================================
Checking for Existing Web Server
================================================
⚠ Ports 80 and/or 443 are in use
ℹ Detected Nginx running on ports 80/443
✓ Will integrate with existing Nginx
ℹ ISP Manager will run on port 5000 (backend)
ℹ Add the generated Nginx config to your existing setup
```

---

## 📊 Port Summary

| Service | Port | Access |
|---------|------|--------|
| ISP Manager Backend | 5000 | Internal (Docker) |
| Your Existing Nginx | 80/443 | External → Port 5000 |
| PostgreSQL | 5433 | Internal (Docker) |
| FreeRADIUS | 1812/1813 | External (UDP) |

---

## 🎉 Summary

**Before (manual editing required):**
```bash
./setup.sh
# Edit .env manually
nano .env
# Change ENABLE_SSL=true to ENABLE_SSL=existing_nginx
# Change APP_DOMAIN...
./deploy.sh
```

**Now (fully automatic):**
```bash
./setup.sh --domain isp.yourcompany.com --email admin@yourcompany.com --existing-nginx
./deploy.sh
./generate-nginx-config.sh
# Add config to Nginx and restart
```

**No manual .env editing needed!** 🎉

---

## 📞 Commands Reference

```bash
# Automatic mode (recommended)
./setup.sh --domain YOUR_DOMAIN --email YOUR_EMAIL --existing-nginx
./deploy.sh

# Interactive mode
./setup.sh
# Answer questions, it auto-detects Nginx

# Generate Nginx config
./generate-nginx-config.sh

# Check status
docker compose ps
sudo systemctl status nginx

# View logs
docker compose logs -f app
sudo tail -f /var/log/nginx/access.log
```

---

**Last Updated:** November 11, 2025  
**Feature:** Automatic Existing Nginx Detection  
**Status:** ✅ Production Ready
