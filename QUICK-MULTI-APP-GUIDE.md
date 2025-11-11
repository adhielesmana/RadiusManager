# Quick Multi-App SSL Guide

## ✅ You're All Set!

For your multi-app server setup, SSL is now **fully automated** in `deploy.sh`.

## 🚀 Usage

### First Time Setup (ONE TIME)
```bash
./setup-multi-app.sh
```

**It will ask:**
- Email for SSL certificates
- How many apps you have
- For each app: name, domain, port

### Deploy (FULLY AUTOMATED)
```bash
./deploy.sh
```

**What it does automatically:**
1. ✅ Deploys Docker containers
2. ✅ **Step 1/2**: Gets SSL certificates for ALL domains
3. ✅ **Step 2/2**: Installs Nginx configs for ALL apps
4. ✅ **Done!** All apps accessible via HTTPS

## 📋 Example Session

```bash
$ ./setup-multi-app.sh
================================================
Multi-App Nginx Configuration Generator
================================================

How many apps do you want to configure? 3

Email for SSL certificates: admin@maxnetplus.id

App 1:
  Name: isp-manager
  Domain: isp.maxnetplus.id
  Port: 5000

App 2:
  Name: monitoring
  Domain: monitor.maxnetplus.id
  Port: 5100

App 3:
  Name: billing
  Domain: billing.maxnetplus.id
  Port: 5200

✓ Generated nginx-configs/isp-manager.conf
✓ Generated nginx-configs/monitoring.conf
✓ Generated nginx-configs/billing.conf
✓ Generated ssl-commands/get-all-certificates.sh
✓ Generated install-to-nginx.sh

$ ./deploy.sh
================================================
ISP Manager - Automated Deployment
================================================
✓ Docker daemon is running
✓ All ports available

================================================
Starting Services
================================================
✓ Services started

================================================
Automated SSL Provisioning
================================================
ℹ Multi-app SSL setup detected

================================================
Step 1/2: SSL Certificate Provisioning
================================================
ℹ Getting certificates for all configured domains...

Found Nginx container: nginx-proxy

Getting certificate for isp.maxnetplus.id...
✓ Certificate obtained for isp.maxnetplus.id

Getting certificate for monitor.maxnetplus.id...
✓ Certificate obtained for monitor.maxnetplus.id

Getting certificate for billing.maxnetplus.id...
✓ Certificate obtained for billing.maxnetplus.id

✓ STEP 1 COMPLETE: All SSL certificates obtained!

================================================
Step 2/2: Nginx Configuration Installation
================================================
ℹ Installing configurations and reloading Nginx...

✓ Copied nginx-configs/isp-manager.conf
✓ Copied nginx-configs/monitoring.conf
✓ Copied nginx-configs/billing.conf
✓ Nginx reloaded

✓ STEP 2 COMPLETE: Nginx configurations installed and reloaded!

================================================
Deployment Complete!
================================================
✓ SSL certificates provisioned and configured!
✓ Nginx configured and reloaded!

ℹ All applications are now accessible via HTTPS
ℹ This app: https://isp.maxnetplus.id
```

## 🔧 Manual Steps (Only if needed)

### If SSL automation fails:

```bash
# Step 1: Get certificates
./ssl-commands/get-all-certificates.sh

# Step 2: Install configs
./install-to-nginx.sh
```

### Skip SSL automation:
```bash
./deploy.sh --skip-ssl
```

## ✨ Features

- ✅ **Robust detection**: Finds your nginx-proxy automatically
- ✅ **Clear logging**: See exactly what's happening
- ✅ **Error recovery**: Helpful messages if something fails
- ✅ **Idempotent**: Safe to run multiple times
- ✅ **No downtime**: Nginx gracefully reloaded (not restarted)

## 📚 More Info

See [MULTI-APP-SSL-AUTOMATION.md](MULTI-APP-SSL-AUTOMATION.md) for complete documentation.
