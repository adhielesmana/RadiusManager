# SSL/HTTPS Setup Guide - Interactive Mode

## ✅ New Interactive SSL Configuration!

Now when you run `./setup.sh`, it will **ask you** if you want to enable SSL/HTTPS with your own domain!

---

## 🚀 How to Use

### **Option 1: Interactive Mode (Recommended)**

Simply run:

```bash
./setup.sh
```

**You'll be asked:**

1. **"Enable SSL/HTTPS?"** (y/n)
   - If you say **yes**, it will ask for:
     - Your domain name (e.g., `isp.yourcompany.com`)
     - Your email address (for Let's Encrypt)
     - Whether to use staging mode for testing

   - If you say **no**, it will run in local development mode (`http://localhost:5000`)

2. The script will automatically:
   - Check if ports 80/443 are available
   - Detect if you have existing Nginx running
   - Offer to integrate with existing Nginx if found
   - Update your `.env` file with SSL settings

3. Then deploy:
   ```bash
   ./deploy.sh
   ```

---

### **Option 2: Command-Line Mode (For Automation)**

If you already know your domain and email:

```bash
./setup.sh --domain isp.yourcompany.com --email admin@yourcompany.com
./deploy.sh
```

---

### **Option 3: Fully Automated Mode**

For completely hands-off setup (no SSL):

```bash
./setup.sh --auto
./deploy.sh
```

---

## 📋 Interactive Example

```bash
$ ./setup.sh

================================================
ISP Manager - Automated Setup
================================================
Mode: INTERACTIVE
SSL Mode: DISABLED (Local development)

================================================
SSL/HTTPS Configuration
================================================

Do you want to enable SSL/HTTPS with your own domain?

Benefits of enabling SSL:
  • Secure HTTPS connection with Let's Encrypt certificate
  • Automatic certificate renewal
  • Professional custom domain (e.g., https://isp.yourcompany.com)

Requirements:
  • A domain name that you own
  • DNS A record pointing to this server's IP
  • Ports 80 and 443 must be available

Note: You can also run without SSL for local development (http://localhost:5000)

Enable SSL/HTTPS? (y/n) y

Enter your domain name (e.g., isp.yourcompany.com): isp.mycompany.com
Enter your email for Let's Encrypt notifications: admin@mycompany.com

Testing mode (optional):
Let's Encrypt has rate limits. Use staging mode for testing.
Staging certificates won't be trusted by browsers, but perfect for testing.

Use staging mode for testing? (y/n) n

✓ SSL configuration saved!
ℹ Domain: isp.mycompany.com
ℹ Email:  admin@mycompany.com
ℹ Staging: false

... (continues with Docker checks, port resolution, etc.)

✓ Setup Complete!
```

Then:

```bash
$ ./deploy.sh

... (deployment proceeds)

✓ ISP Manager is now running at https://isp.mycompany.com
```

---

## 🔧 If You Already Ran Setup

If you already ran `./setup.sh` before this update, you have two options:

### **Option A: Re-run setup (Recommended)**

```bash
./setup.sh
```

It will detect your existing `.env` and ask if you want to regenerate it, or it will just update the SSL settings.

### **Option B: Manual Edit**

Edit your `.env` file:

```bash
nano .env
```

Change these lines:

```bash
ENABLE_SSL=true
APP_DOMAIN=isp.yourcompany.com
LETSENCRYPT_EMAIL=admin@yourcompany.com
```

Then redeploy:

```bash
docker compose down
./deploy.sh
```

---

## 🌐 What Happens After SSL Setup

1. **Let's Encrypt Certificate**: Automatically obtained (takes 1-2 minutes)
2. **HTTP → HTTPS Redirect**: All HTTP traffic redirects to HTTPS
3. **Auto-Renewal**: Certificates automatically renew every 12 hours
4. **Your domain**: Accessible at `https://isp.yourcompany.com`

---

## 🧪 Testing with Staging Mode

To avoid hitting Let's Encrypt rate limits while testing:

```bash
./setup.sh
```

When asked "Use staging mode for testing?", answer **y**.

This uses Let's Encrypt's staging server. The certificate won't be trusted by browsers (you'll see a warning), but it's perfect for testing the setup.

Once you've confirmed everything works, run setup again and answer **n** to staging mode.

---

## ⚠️ Prerequisites

Before enabling SSL, make sure:

1. **DNS Configured**: Your domain's A record points to this server's IP
   ```bash
   nslookup isp.yourcompany.com
   # Should show your server's IP
   ```

2. **Ports Open**: Ports 80 and 443 must be accessible
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   ```

3. **No Port Conflicts**: No other service using ports 80/443
   - If you have existing Nginx, the setup script will detect it and offer integration

---

## 🔍 Troubleshooting

### **"Ports 80/443 are in use"**

**If Nginx detected:**
- The script will ask if you want to use existing Nginx
- If yes, ISP Manager runs on port 5000 and you add Nginx config
- Run `./generate-nginx-config.sh` to get the Nginx configuration

**If other service:**
- Stop the service using ports 80/443, or
- Run without SSL in local mode

### **"Certificate failed to obtain"**

Check:
1. DNS is properly configured (wait up to 48 hours for propagation)
2. Ports 80/443 are accessible from the internet
3. No firewall blocking Let's Encrypt validation
4. Check logs: `docker compose -f docker-compose.yml -f docker-compose.ssl.yml logs reverse-proxy`

### **"SSL mode disabled after setup"**

This happens if:
- Ports 80/443 were unavailable during setup
- You declined SSL when prompted
- Another service was detected on those ports

Re-run `./setup.sh` after fixing the port conflicts.

---

## 📞 Quick Commands

```bash
# Interactive setup (asks about SSL)
./setup.sh

# Setup with SSL (skip prompts)
./setup.sh --domain isp.example.com --email admin@example.com

# Setup with SSL in staging mode
./setup.sh --domain test.example.com --email admin@example.com --staging

# Fully automated (no SSL, no prompts)
./setup.sh --auto

# Deploy after setup
./deploy.sh

# Check SSL certificate status
docker compose -f docker-compose.yml -f docker-compose.ssl.yml exec reverse-proxy certbot certificates

# View current configuration
grep -E "ENABLE_SSL|APP_DOMAIN" .env
```

---

**Last Updated:** November 11, 2025  
**Feature:** Interactive SSL Configuration  
**Status:** ✅ Ready to Use
