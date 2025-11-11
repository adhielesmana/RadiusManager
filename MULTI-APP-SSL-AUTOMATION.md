# Multi-App SSL Automation in deploy.sh

## Overview
The `deploy.sh` script now fully automates SSL certificate provisioning for **both single-app and multi-app setups** when using existing Nginx Docker containers.

## How It Works

### 🔍 Auto-Detection
When you run `./deploy.sh`, it automatically detects your setup:

1. **Multi-app setup**: If `ssl-commands/` directory exists with generated scripts
2. **Single-app setup**: If only `ssl-provision.sh` exists
3. **No SSL setup**: Suggests running setup scripts

### 🚀 Multi-App Automation Flow

```bash
./deploy.sh
```

**What happens automatically:**

```
1. ✓ Deploy all Docker containers
2. ✓ Detect multi-app SSL setup
3. ✓ Step 1/2: Get SSL certificates for all domains
   └─> Runs: ./ssl-commands/get-all-certificates.sh
4. ✓ Step 2/2: Install Nginx configurations
   └─> Runs: ./install-to-nginx.sh
5. ✓ All apps now accessible via HTTPS!
```

### ⚙️ Setup Flow Comparison

#### Multi-App Setup (Multiple Docker apps on one server)
```bash
# Step 1: Configure SSL for all apps (ONE TIME)
./setup-multi-app.sh
  ├─> Enter email for SSL
  ├─> Enter number of apps
  └─> For each app: name, domain, port

# Step 2: Deploy (FULLY AUTOMATED)
./deploy.sh
  ├─> Deploys Docker containers
  ├─> Gets SSL certs for ALL domains
  ├─> Installs ALL Nginx configs
  └─> ✓ Done! All apps on HTTPS
```

#### Single-App Setup (One Docker app)
```bash
# Step 1: Configure SSL (ONE TIME)
./setup.sh
  └─> Select "Use existing Nginx Docker"

# Step 2: Deploy (FULLY AUTOMATED)
./deploy.sh
  ├─> Deploys Docker containers
  ├─> Gets SSL certificate
  ├─> Installs Nginx config
  └─> ✓ Done! App on HTTPS
```

## Generated Scripts

### Multi-App Setup Creates:

**1. ssl-commands/get-all-certificates.sh**
- Detects your nginx-proxy container (robust detection)
- Stops Nginx temporarily
- Gets Let's Encrypt certificates for all domains
- Restarts Nginx

**2. install-to-nginx.sh**
- Detects your nginx-proxy container (robust detection)
- Copies all Nginx configs to container
- Reloads Nginx gracefully
- No downtime

**3. nginx-configs/*.conf**
- Individual config file for each app
- SSL/TLS configuration
- Proxy pass to backend port
- WebSocket support

### Single-App Setup Creates:

**ssl-provision.sh**
- All-in-one script for single domain
- Certificate provisioning + config installation

## Command Line Options

```bash
# Normal deployment with SSL automation
./deploy.sh

# Skip SSL provisioning (deploy only)
./deploy.sh --skip-ssl

# Force rebuild with SSL
./deploy.sh --rebuild
```

## Error Handling

### If Step 1 Fails (Certificate Provisioning)
```
⚠ Certificate provisioning encountered an issue
ℹ You can run './ssl-commands/get-all-certificates.sh' manually later

Step 2 automatically skipped (no certs = no config to install)
```

**Manual recovery:**
```bash
./ssl-commands/get-all-certificates.sh
./install-to-nginx.sh
```

### If Step 2 Fails (Nginx Config Installation)
```
✓ All SSL certificates obtained!
⚠ Nginx configuration installation encountered an issue
ℹ You can run './install-to-nginx.sh' manually later
```

**Manual recovery:**
```bash
./install-to-nginx.sh
```

## Success Messages

### Multi-App Success
```
================================================
Deployment Complete!
================================================
✓ ISP Manager backend is running on http://localhost:5000

✓ SSL certificates provisioned and configured!
✓ Nginx configured and reloaded!

ℹ All applications are now accessible via HTTPS
ℹ This app: https://isp.maxnetplus.id
```

### Single-App Success
```
================================================
Deployment Complete!
================================================
✓ ISP Manager backend is running on http://localhost:5000

✓ SSL certificate provisioned and configured!
✓ Nginx configured and reloaded!

ℹ Your ISP Manager is now accessible at: https://yourdomain.com
```

## Robust Container Detection

Both setup scripts and generated scripts use the same detection logic:

```bash
# Validates containers have:
✓ Public ports 80/443 exposed (0.0.0.0 or ::)
✓ Name/image matches "nginx" or "proxy"
✓ /etc/letsencrypt mount for SSL storage
✓ Not loopback-only (127.0.0.1)
```

**Example containers detected:**
- `nginx-proxy`
- `jwilder-nginx-proxy`
- `reverse-proxy`
- `my-nginx`
- Any nginx/proxy container with public ports

**Example containers ignored:**
- `isp-manager-reverse-proxy` (app-specific, port 5000 only)
- `app-nginx` (loopback only)
- `monitoring-nginx` (no public ports)

## Full Automation Summary

### What's Automated in deploy.sh:

| Feature | Single-App | Multi-App |
|---------|-----------|-----------|
| Docker deployment | ✅ | ✅ |
| Nginx detection | ✅ | ✅ |
| Certificate provisioning | ✅ | ✅ |
| Nginx config installation | ✅ | ✅ |
| Nginx reload | ✅ | ✅ |
| Error recovery guidance | ✅ | ✅ |

### What You Need to Do Manually:

1. **One-time setup** (setup.sh or setup-multi-app.sh)
2. **Run deploy.sh** (everything else is automated!)

## User Experience

### Before (Manual Steps)
```bash
./setup-multi-app.sh
./deploy.sh
./ssl-commands/get-all-certificates.sh  # ❌ Manual
./install-to-nginx.sh                    # ❌ Manual
```

### After (Fully Automated)
```bash
./setup-multi-app.sh
./deploy.sh  # ✅ Everything automated!
```

## Technical Implementation

### State Tracking

```bash
CERTS_OBTAINED=false  # Tracks Step 1 success
SSL_PROVISIONED=false # Tracks overall success

# Step 1: Get certificates
if get-all-certificates.sh succeeds:
    CERTS_OBTAINED=true

# Step 2: Install configs (only if Step 1 succeeded)
if CERTS_OBTAINED=true:
    if install-to-nginx.sh succeeds:
        SSL_PROVISIONED=true
```

### Idempotency

- ✅ Running `./deploy.sh` multiple times is safe
- ✅ Certificate provisioning uses Let's Encrypt (checks existing certs)
- ✅ Nginx configs are overwritten (latest version wins)
- ✅ No manual cleanup required

## Troubleshooting

### "No SSL provisioning scripts found"
**Solution:** Run setup first
```bash
./setup-multi-app.sh  # For multi-app
# OR
./setup.sh            # For single-app
```

### "Could not find nginx container"
**Problem:** Your Nginx container isn't publicly accessible

**Check:**
```bash
docker ps
docker port <nginx-container>
```

**Should show:**
```
80/tcp -> 0.0.0.0:80
443/tcp -> 0.0.0.0:443
```

### "Certificate provisioning encountered an issue"
**Common causes:**
1. Port 80/443 not accessible
2. DNS not pointing to server
3. Firewall blocking ports

**Debug:**
```bash
# Check DNS
dig yourdomain.com

# Test port 80
curl -I http://yourdomain.com

# Check firewall
sudo ufw status
```

## Migration Guide

### Already Using Old deploy.sh?

No changes needed! The script auto-detects your setup:

```bash
# If you have ssl-commands/
→ Uses multi-app automation

# If you have ssl-provision.sh
→ Uses single-app automation

# If you have neither
→ Suggests running setup scripts
```

## Best Practices

1. **Run setup scripts ONCE** per environment
2. **Run deploy.sh** whenever you update code
3. **Use --skip-ssl** if you want to provision SSL manually later
4. **Monitor logs** during first deployment to verify SSL setup

## See Also

- [AUTO-SSL-DETECTION.md](AUTO-SSL-DETECTION.md) - Container detection logic
- [AUTOMATED-SSL-SUMMARY.md](AUTOMATED-SSL-SUMMARY.md) - Single-app SSL automation
- [setup.sh](setup.sh) - Single-app setup script
- [setup-multi-app.sh](setup-multi-app.sh) - Multi-app setup script
- [deploy.sh](deploy.sh) - Automated deployment script
