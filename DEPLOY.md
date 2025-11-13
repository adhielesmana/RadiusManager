# ISP Manager - Production Deployment

## Quick Start (2 Commands)

### Step 1: Setup (Run Once)
```bash
./setup.sh --domain isp.maxnetplus.id --email adhielesmana@gmail.com
```

This installs:
- ✓ Nginx (on host)
- ✓ Certbot (for SSL)
- ✓ Docker
- ✓ Configures environment

### Step 2: Deploy
```bash
./deploy.sh
```

This will:
- ✓ Build and start Docker containers (PostgreSQL, FreeRADIUS, App)
- ✓ Configure nginx reverse proxy to port 5002
- ✓ Obtain SSL certificate via Let's Encrypt
- ✓ Enable HTTPS access

## Result

Your app will be accessible at:
**https://isp.maxnetplus.id**

---

## Fast Nginx Updates (No Docker Rebuild)

When you only need to update nginx configuration (no app changes):

```bash
./deploy.sh --nginx-only
```

This will:
- ✓ Update nginx site configuration
- ✓ Reload nginx
- ✓ Update SSL if needed
- ✓ **Skip Docker rebuild** (saves time!)

Perfect for:
- Changing domain
- Updating SSL settings
- Modifying proxy settings
- Testing nginx configuration

---

## Architecture

```
Internet → Nginx (Host:80/443) → Docker App (localhost:5002)
           ↓
        SSL (certbot)
```

- **Nginx**: Runs on host OS (not Docker)
- **App**: Runs in Docker on port 5002
- **SSL**: Managed by certbot on host

---

## Troubleshooting

### App runs on localhost:5002 but not on domain?
Nginx configuration needs write permissions. If you get permission errors:
```bash
sudo ./deploy.sh --nginx-only
```

### SSL certificate failed?
Ensure:
- Domain DNS points to your server IP
- Port 80 and 443 are open in firewall
- Run manually: `sudo certbot --nginx -d isp.maxnetplus.id`

### Check nginx status
```bash
sudo systemctl status nginx
sudo nginx -t  # Test configuration
```

### Check SSL certificate
```bash
sudo certbot certificates
```

### View logs
```bash
docker compose logs -f app
```
