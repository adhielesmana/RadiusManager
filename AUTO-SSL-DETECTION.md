# 🔍 Automatic SSL Detection - Smart Setup!

## ✨ What's New

**setup.sh and setup-multi-app.sh now automatically detect Nginx and configure SSL!**

No more manual configuration - just provide your domain and email!

---

## 🚀 How It Works

### **Automatic Detection**

When you run `./setup.sh`, it automatically:

1. ✅ Scans for Docker containers
2. ✅ Finds Nginx containers with ports 80/443 **publicly exposed** (0.0.0.0 or ::)
3. ✅ Validates `/etc/letsencrypt` volume mount
4. ✅ Shows you what it found and asks for confirmation
5. ✅ Only prompts for **domain** and **email** (required fields you know!)

### **Smart Configuration**

If Nginx is detected:
- Automatically enables `existing_nginx` mode
- Sets up ISP Manager on port 5000
- Configures automated SSL provisioning
- Validates your email format
- Still lets you choose staging vs production mode

If no Nginx detected:
- Falls back to traditional setup prompts
- Guides you through all options
- No breaking changes!

---

## 📋 Prerequisites

### **Your Nginx Container Must Have:**

1. **Public Port Bindings (80 and/or 443)**
   ```bash
   -p 80:80 -p 443:443
   ```
   
   ⚠️ **Not loopback-only** (`127.0.0.1:80` won't work)

2. **/etc/letsencrypt Volume Mount**
   ```bash
   -v /etc/letsencrypt:/etc/letsencrypt:ro
   ```

3. **Nginx Config Directory Mount**
   ```bash
   -v /etc/nginx/conf.d:/etc/nginx/conf.d
   ```

### **Example Nginx Container:**

```bash
docker run -d \
  --name nginx-proxy \
  -p 80:80 \
  -p 443:443 \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -v /etc/nginx/conf.d:/etc/nginx/conf.d \
  --restart unless-stopped \
  nginx:latest
```

---

## 🎯 Example Session

```bash
root@server:~$ ./setup.sh

================================================
SSL/HTTPS Configuration
================================================

✓ Detected Nginx Docker container: nginx-proxy

Automatic SSL Configuration Available!
  • Your Nginx container is running on ports 80/443
  • ISP Manager will run on port 5000
  • Automated SSL certificate provisioning with Let's Encrypt
  • Automatic Nginx configuration generation

✓ /etc/letsencrypt is already mounted in Nginx container

Use nginx-proxy for SSL integration? (y/n) y

Please provide the following information:

Domain name (e.g., isp.yourcompany.com): isp.maxnetplus.id
Email for Let's Encrypt notifications: admin@maxnetplus.id

Testing mode (optional):
Let's Encrypt has rate limits. Use staging mode for testing.

Use staging mode for testing? (y/n) n

✓ SSL will be configured with:
  • Domain: isp.maxnetplus.id
  • Email: admin@maxnetplus.id
  • Nginx: nginx-proxy (existing container)
  • Staging: false

ℹ Run ./deploy.sh to automatically provision SSL certificate!

================================================
Setup Complete!
================================================
```

**That's it!** Now just run `./deploy.sh` and your SSL certificate will be provisioned automatically! 🎉

---

## ⚙️ What Gets Configured

### **In your .env file:**

```bash
ENABLE_SSL=existing_nginx
APP_DOMAIN=isp.maxnetplus.id
LETSENCRYPT_EMAIL=admin@maxnetplus.id
LE_STAGING=false
```

### **Then deploy.sh automatically:**

1. Starts ISP Manager services
2. Generates Nginx configuration
3. Detects your nginx-proxy container
4. Stops Nginx temporarily
5. Gets SSL certificate from Let's Encrypt
6. Starts Nginx
7. Installs configuration
8. Reloads Nginx
9. Verifies HTTPS works!

**Zero manual commands!** ✨

---

## 🔧 Advanced Usage

### **Skip Auto-Detection**

If you want to decline the detected Nginx:

```bash
./setup.sh

...
Use nginx-proxy for SSL integration? (y/n) n

ℹ Skipping automatic SSL configuration
ℹ You can enable SSL manually later or run setup again
```

### **Command-Line Options (Still Work!)**

```bash
# Specify everything upfront
./setup.sh --domain isp.example.com --email admin@example.com --existing-nginx

# Use staging mode
./setup.sh --domain test.example.com --email admin@example.com --staging

# Fully automated (no prompts)
./setup.sh --auto --domain isp.example.com --email admin@example.com
```

---

## 🛡️ Safety Features

### **1. Public Port Validation**

Only detects containers with ports **publicly accessible**:
- ✅ `0.0.0.0:80->80/tcp` (public)
- ✅ `:::443->443/tcp` (public IPv6)
- ❌ `127.0.0.1:8080->80/tcp` (loopback only - ignored)

This prevents false positives from app-specific nginx sidecars.

### **2. User Confirmation**

Always asks before enabling SSL integration:
```
Use nginx-proxy for SSL integration? (y/n)
```

You can decline and configure manually.

### **3. Email Validation**

Validates email format with regex:
```bash
Email for Let's Encrypt notifications: invalid-email

✗ Valid email address is required
```

### **4. Mount Validation**

Warns if `/etc/letsencrypt` is not mounted:
```
⚠ /etc/letsencrypt is NOT mounted in Nginx container

Important: Your Nginx container needs this volume mount:
  -v /etc/letsencrypt:/etc/letsencrypt:ro

SSL provisioning may fail without this mount.
You can still continue - the deployment will guide you if needed.
```

### **5. Graceful Fallback**

If Docker not running or no Nginx found:
- Falls back to traditional interactive prompts
- No errors or crashes
- All features still available

---

## 📊 Detection Logic

### **How Nginx is Detected:**

```bash
1. Check if Docker is running
2. For each running container:
   a. Inspect port bindings
   b. Check for public 80/443 bindings (0.0.0.0 or ::)
   c. Check if container/image name contains "nginx" or "proxy"
3. Return first matching container
4. Validate /etc/letsencrypt mount
5. Show results to user
```

### **Container Matching:**

Matches containers where:
- **Ports**: 80 or 443 publicly exposed
- **Name/Image**: Contains "nginx" or "proxy"

**Examples:**
- ✅ `nginx-proxy` (nginx image, ports 80/443)
- ✅ `reverse-proxy` (nginx image, ports 80/443)
- ✅ `jwilder/nginx-proxy` (nginx-proxy image)
- ❌ `app-nginx` (port 8080, loopback only)
- ❌ `my-app` (no nginx in name/image)

---

## 🎓 Multi-App Setup

**setup-multi-app.sh** also has auto-detection!

```bash
./setup-multi-app.sh

================================================
Nginx Detection
================================================

✓ Detected Nginx Docker container: nginx-proxy

Automatic SSL Configuration Available!
  • Your Nginx container is running on ports 80/443
  • Each app will run on a different port (5000, 5100, etc.)
  • Automated SSL certificate provisioning with Let's Encrypt
  • Automatic Nginx configuration generation for all apps

✓ /etc/letsencrypt is already mounted in Nginx container

ℹ This setup will create separate .env files for each app
ℹ Each app will be configured to use nginx-proxy for SSL

...
```

Then it guides you through configuring multiple apps!

---

## ❓ FAQ

### **Q: What if I have multiple Nginx containers?**

Currently uses the first matching container. You can decline and configure manually if needed.

### **Q: Can I skip the auto-detection?**

Yes! Decline when prompted or run with `--auto` and specific flags.

### **Q: What if my Nginx doesn't have /etc/letsencrypt mounted?**

Setup will warn you but allow continuation. SSL provisioning will guide you to fix it.

### **Q: Does this work for non-Docker Nginx?**

Not yet - auto-detection is Docker-only. Use traditional prompts for system Nginx.

### **Q: Can I test with staging certificates?**

Yes! You'll still be asked about staging mode:
```
Use staging mode for testing? (y/n) y
```

### **Q: Will this break my existing setup?**

No! Auto-detection only runs during setup. Existing .env files are not modified unless you run setup again and confirm changes.

---

## 🔗 Related Documentation

- [AUTOMATED-SSL-SUMMARY.md](AUTOMATED-SSL-SUMMARY.md) - Overview of automated SSL provisioning
- [SSL-AUTOMATION.md](SSL-AUTOMATION.md) - Detailed SSL automation guide
- [SIMPLE-MULTI-APP-GUIDE.md](SIMPLE-MULTI-APP-GUIDE.md) - Multi-app deployment
- [DOCKER-AUTO-DETECTION.md](DOCKER-AUTO-DETECTION.md) - Docker container detection

---

## ✅ Summary

**Before (Manual):**
```bash
./setup.sh
# Answer 10+ questions
# Manually configure SSL mode
# Figure out existing Nginx integration
# Edit .env file manually
```

**After (Automatic):**
```bash
./setup.sh
# Auto-detects Nginx ✨
# Shows what was found
# Ask for confirmation: y
# Domain: isp.example.com
# Email: admin@example.com
# Staging: n
# Done! Run ./deploy.sh
```

**From 10+ manual steps to 5 simple questions!** 🚀

---

**Created:** November 11, 2025  
**Status:** ✅ Production Ready  
**Tested:** Docker Nginx auto-detection with public port validation
