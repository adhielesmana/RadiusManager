# ISP Manager - Docker Deployment Guide

## Overview

This guide explains how to run the complete ISP Manager system with FreeRADIUS authentication using Docker Compose. The dockerized setup includes:

- **PostgreSQL** - Shared database for ISP Manager and FreeRADIUS
- **FreeRADIUS Server** - RADIUS authentication with PostgreSQL backend
- **ISP Manager Application** - Node.js/React application with Express backend

## Architecture

```
┌─────────────────┐
│  ISP Manager    │
│  (Node.js +     │
│   React)        │
│  Port: 5000     │
└────────┬────────┘
         │
         │ PostgreSQL
         │ Connection
         │
┌────────┴────────┐         ┌─────────────────┐
│   PostgreSQL    │◄────────┤  FreeRADIUS     │
│   Database      │         │  Server         │
│   Port: 5432    │         │  Ports:         │
│                 │         │  1812/udp       │
│   Tables:       │         │  1813/udp       │
│   - customers   │         └─────────────────┘
│   - subscriptions         ▲
│   - profiles              │
│   - invoices              │ RADIUS Auth
│   - radcheck              │ Requests
│   - radreply              │
│   - radacct               │
│   - nas                   │
└───────────────────────────┘
         ▲
         │
    ┌────┴─────┐
    │  Router  │
    │   NAS    │
    └──────────┘
```

## Quick Start

### Automated Setup (Recommended)

For a completely automated setup on a new server, use the provided scripts:

**1. Run initial setup (one-time):**
```bash
./setup.sh
```

This will:
- ✅ Check and install Docker (if needed on Linux)
- ✅ Verify Docker Compose installation
- ✅ Check port availability
- ✅ Create `.env` file with secure random secrets
- ✅ Verify all prerequisites

**2. Deploy the application:**
```bash
./deploy.sh
```

This will:
- ✅ Build Docker images
- ✅ Start all services (PostgreSQL, FreeRADIUS, ISP Manager)
- ✅ Wait for services to be ready
- ✅ Display access information and useful commands

**That's it!** Your ISP Manager is now running at http://localhost:5000

### Production Setup with SSL/HTTPS

For production deployment with a custom domain and automatic SSL certificates:

**1. Prepare your domain:**
- Point your domain's A record to your server's public IP
- Ensure ports 80 and 443 are open in your firewall
- Wait for DNS propagation (check with `nslookup your-domain.com`)

**2. Run setup with domain:**
```bash
./setup.sh --domain isp.example.com --email admin@example.com
```

This will:
- ✅ Configure SSL with Let's Encrypt
- ✅ Set up Nginx reverse proxy
- ✅ Generate secure secrets
- ✅ Validate port availability (80, 443, 5432, 1812, 1813)

**3. Deploy with SSL:**
```bash
./deploy.sh
```

The deployment will:
- ✅ Start Nginx reverse proxy with SSL
- ✅ Automatically obtain Let's Encrypt certificates
- ✅ Configure HTTP to HTTPS redirect
- ✅ Set up auto-renewal (daily check at 2 AM)

**Your ISP Manager is now running at https://isp.example.com** 🎉

#### Testing SSL Setup (Staging Mode)

To test SSL configuration without hitting Let's Encrypt rate limits:

```bash
./setup.sh --domain test.example.com --email admin@example.com --staging
```

This uses Let's Encrypt's staging server, perfect for testing before going to production.

### Manual Setup (Alternative)

If you prefer manual setup or the scripts don't work on your system:

#### Prerequisites

- Docker Engine 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose V2 ([Install Docker Compose](https://docs.docker.com/compose/install/))
- 2GB+ RAM available for containers
- Ports 5000, 5432, 1812/udp, 1813/udp available

#### 1. Initial Setup

**Clone or navigate to the project directory:**
```bash
cd isp-manager
```

**Copy environment template:**
```bash
cp .env.example .env
```

**Edit `.env` file and customize:**
```bash
# Important: Change these in production!
DB_PASSWORD=your_secure_database_password
SESSION_SECRET=your_secure_random_session_secret_min_32_chars
RADIUS_SECRET=your_radius_shared_secret
```

**Note:** The `RADIUS_SECRET` is automatically used by all RADIUS clients (localhost, Docker network, and custom NAS devices defined in `docker/freeradius/clients.conf`). Changing this value will update the shared secret for all clients system-wide.

#### 2. Build and Start All Services

**Start in production mode:**
```bash
docker compose up -d
```

**Start with logs visible (for debugging):**
```bash
docker compose up
```

**Build and start (forces rebuild):**
```bash
docker compose up --build -d
```

### 3. Verify Services

**Check running containers:**
```bash
docker-compose ps
```

Expected output:
```
NAME                  STATUS    PORTS
isp-manager-app       Up        0.0.0.0:5000->5000/tcp
isp-freeradius        Up        0.0.0.0:1812-1813->1812-1813/udp
isp-postgres          Up        0.0.0.0:5432->5432/tcp
```

**Check logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f freeradius
docker-compose logs -f postgres
```

**Access the application:**
```
http://localhost:5000
```

**Default credentials:**
- Username: `adhielesmana`
- Password: `admin123`

## Service Management

### Start Services
```bash
docker-compose up -d
```

### Stop Services
```bash
docker-compose down
```

### Stop and Remove Volumes (⚠️ Deletes all data!)
```bash
docker-compose down -v
```

### Restart Single Service
```bash
docker-compose restart app
docker-compose restart freeradius
docker-compose restart postgres
```

### View Service Logs
```bash
# Follow logs (live)
docker-compose logs -f app

# Last 100 lines
docker-compose logs --tail=100 freeradius

# All logs
docker-compose logs
```

## Database Management

### Access PostgreSQL CLI
```bash
docker-compose exec postgres psql -U ispuser -d ispmanager
```

### Common Database Commands
```sql
-- List all tables
\dt

-- View FreeRADIUS tables
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'rad%';

-- Check radcheck users
SELECT * FROM radcheck;

-- Check NAS clients
SELECT * FROM nas;

-- Check active sessions
SELECT * FROM radacct WHERE acctstoptime IS NULL;

-- Exit
\q
```

### Database Backup
```bash
# Create backup
docker-compose exec postgres pg_dump -U ispuser ispmanager > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U ispuser ispmanager < backup.sql
```

## FreeRADIUS Configuration

### Test RADIUS Authentication

**Install RADIUS client tools (on host machine):**
```bash
# Ubuntu/Debian
sudo apt-get install freeradius-utils

# macOS
brew install freeradius-server

# CentOS/RHEL
sudo yum install freeradius-utils
```

**Test authentication:**
```bash
# Test with default user (if exists in radcheck table)
radtest testuser testpass localhost 0 testing123

# Test with customer username (created via ISP Manager)
radtest customer_username customer_password localhost 0 testing123
```

**Expected output (successful):**
```
Sent Access-Request Id 123 from 0.0.0.0:12345 to 127.0.0.1:1812 length 77
Received Access-Accept Id 123 from 127.0.0.1:1812 to 0.0.0.0:12345 length 20
```

**Expected output (failed):**
```
Received Access-Reject Id 123 from 127.0.0.1:1812 to 0.0.0.0:12345 length 20
```

### Debug FreeRADIUS

**Run in debug mode:**
```bash
docker-compose exec freeradius radiusd -X
```

This shows detailed authentication flow and helps troubleshoot issues.

### Add NAS Client

NAS (Network Access Server) clients are the routers/switches that send RADIUS requests.

**Via Database:**
```bash
docker-compose exec postgres psql -U ispuser -d ispmanager
```

```sql
INSERT INTO nas (nasname, shortname, type, ports, secret, description)
VALUES ('192.168.1.1', 'main-router', 'cisco', 0, 'SecureSecret123', 'Main Office Router');
```

**Via Configuration File:**

Edit `docker/freeradius/clients.conf`:
```conf
client my-router {
    ipaddr = 192.168.1.1
    secret = SecureSecret123
    shortname = main-router
    nas_type = cisco
}
```

Then restart FreeRADIUS:
```bash
docker-compose restart freeradius
```

## Development Mode

For active development with hot-reload:

**Edit `docker-compose.yml`** - Uncomment the volume mounts:
```yaml
app:
  volumes:
    # Uncommented for development
    - ./client:/app/client
    - ./server:/app/server
    - ./shared:/app/shared
    - /app/node_modules
```

**Restart services:**
```bash
docker-compose down
docker-compose up -d
```

Now code changes will auto-reload without rebuilding the container.

## Production Deployment

### Security Checklist

- [ ] Change `DB_PASSWORD` to strong password (20+ characters)
- [ ] Change `SESSION_SECRET` to random string (32+ characters)
- [ ] Change `RADIUS_SECRET` for each NAS client
- [ ] Update `docker/freeradius/clients.conf` with actual router IPs
- [ ] Remove debug mode from FreeRADIUS (`-X` flag)
- [ ] Enable HTTPS/TLS for ISP Manager app (use nginx reverse proxy)
- [ ] Configure firewall rules (restrict PostgreSQL port 5432)
- [ ] Set up regular database backups
- [ ] Configure log rotation
- [ ] Use Docker secrets instead of environment variables

### Environment Variables (Production)

```bash
# .env (production)
NODE_ENV=production
DB_PASSWORD=SecureRandomPassword123!@#
SESSION_SECRET=SecureRandomSessionSecret32CharactersMin!
RADIUS_SECRET=SecureRadiusSharedSecret123!
```

### Nginx Reverse Proxy (Optional)

```nginx
# /etc/nginx/sites-available/ispmanager
server {
    listen 80;
    server_name ispmanager.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable with SSL:
```bash
sudo certbot --nginx -d ispmanager.yourdomain.com
```

### Resource Limits (Production)

Edit `docker-compose.yml` to add resource limits:
```yaml
app:
  deploy:
    resources:
      limits:
        cpus: '2.0'
        memory: 1G
      reservations:
        cpus: '0.5'
        memory: 512M
```

## Troubleshooting

### SSL Certificate Issues

**Certificate not obtained:**
```bash
# Check Nginx logs
docker compose -f docker-compose.yml -f docker-compose.ssl.yml logs reverse-proxy

# Verify DNS points to your server
nslookup your-domain.com

# Test port 80 accessibility
curl -I http://your-domain.com/.well-known/acme-challenge/test

# Manual certificate request
docker compose -f docker-compose.yml -f docker-compose.ssl.yml exec reverse-proxy \
  certbot certonly --webroot -w /var/www/certbot \
  -d your-domain.com --email your@email.com --agree-tos
```

**Certificate expired or needs renewal:**
```bash
# Manual renewal
docker compose -f docker-compose.yml -f docker-compose.ssl.yml exec reverse-proxy certbot renew

# Check renewal status
docker compose -f docker-compose.yml -f docker-compose.ssl.yml exec reverse-proxy certbot certificates

# View renewal logs
docker compose -f docker-compose.yml -f docker-compose.ssl.yml exec reverse-proxy cat /var/log/certbot-renew.log
```

**Switch from staging to production certificates:**
```bash
# 1. Update .env file
sed -i 's/LE_STAGING=true/LE_STAGING=false/' .env

# 2. Remove staging certificates
docker compose -f docker-compose.yml -f docker-compose.ssl.yml exec reverse-proxy \
  rm -rf /etc/letsencrypt/live/*
docker compose -f docker-compose.yml -f docker-compose.ssl.yml exec reverse-proxy \
  rm -rf /etc/letsencrypt/archive/*
docker compose -f docker-compose.yml -f docker-compose.ssl.yml exec reverse-proxy \
  rm -rf /etc/letsencrypt/renewal/*

# 3. Restart to obtain production certificate
docker compose -f docker-compose.yml -f docker-compose.ssl.yml restart reverse-proxy
```

### Container Won't Start

**Check logs:**
```bash
docker compose logs app
docker compose logs freeradius
# For SSL mode:
docker compose -f docker-compose.yml -f docker-compose.ssl.yml logs reverse-proxy
```

**Check container status:**
```bash
docker compose ps
docker ps -a
```

**Remove and recreate:**
```bash
docker compose down
docker compose up -d --force-recreate
# For SSL mode:
docker compose -f docker-compose.yml -f docker-compose.ssl.yml down
docker compose -f docker-compose.yml -f docker-compose.ssl.yml up -d --force-recreate
```

### PostgreSQL Connection Issues

**Test connection:**
```bash
docker-compose exec app sh
nc -zv postgres 5432
```

**Check PostgreSQL logs:**
```bash
docker compose logs postgres
```

**Verify credentials:**
```bash
docker compose exec postgres psql -U ispuser -d ispmanager -c "SELECT 1"
```

### FreeRADIUS Not Responding

**Check if RADIUS is listening:**
```bash
docker-compose exec freeradius netstat -ulnp | grep 1812
```

**Test locally inside container:**
```bash
docker-compose exec freeradius radtest testuser testpass 127.0.0.1 0 testing123
```

**Check SQL connection:**
```bash
docker-compose logs freeradius | grep -i sql
```

### Port Already in Use

```bash
# Find process using port 5000
sudo lsof -i :5000
sudo netstat -tulpn | grep 5000

# Kill process
sudo kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "5001:5000"  # Changed from 5000:5000
```

### Database Migrations

If you need to reset the database:
```bash
# Stop services
docker-compose down

# Remove database volume
docker volume rm isp-manager_postgres-data

# Restart (will recreate with fresh schema)
docker-compose up -d
```

## Monitoring

### Health Checks

**Application health:**
```bash
curl http://localhost:5000/api/dashboard/stats
```

**Database health:**
```bash
docker-compose exec postgres pg_isready -U ispuser
```

**FreeRADIUS health:**
```bash
radtest testuser testpass localhost 0 testing123
```

### Resource Usage

```bash
# All containers
docker stats

# Specific container
docker stats isp-manager-app
```

### Log Management

**Limit log size** in `docker-compose.yml`:
```yaml
app:
  logging:
    driver: "json-file"
    options:
      max-size: "10m"
      max-file: "3"
```

## Automated Deployment Scripts

### setup.sh - Initial Server Setup

Prepares a new development server for ISP Manager deployment.

**Usage:**
```bash
./setup.sh
```

**What it does:**
- Detects operating system (Linux/macOS)
- Checks Docker installation (offers to install on Linux)
- Verifies Docker Compose availability
- Checks if Docker daemon is running
- Verifies port availability (5000, 5432, 1812, 1813)
- Creates `.env` file with secure random secrets
- Creates required directories
- Optionally installs Node.js dependencies

**Supported Platforms:**
- Ubuntu/Debian
- CentOS/RHEL/Fedora
- macOS (requires Docker Desktop pre-installed)

### deploy.sh - Application Deployment

Builds and deploys the ISP Manager application.

**Usage:**
```bash
# Standard deployment
./deploy.sh

# Force rebuild of Docker images
./deploy.sh --rebuild

# Skip building, just restart services
./deploy.sh --skip-build

# Show help
./deploy.sh --help
```

**What it does:**
- Checks prerequisites (Docker, Docker Compose, .env)
- Stops existing containers
- Builds Docker images (optional)
- Starts all services
- Waits for services to be healthy
- Displays service status and logs
- Shows access information and useful commands

**Options:**
- `--rebuild` - Force rebuild of Docker images from scratch
- `--skip-build` - Skip image building, only restart services
- `--help` - Display help message

## Updating the Application

### Using Deployment Script (Recommended)
```bash
# Pull latest code
git pull origin main

# Deploy with rebuild
./deploy.sh --rebuild
```

### Manual Update
```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Zero-Downtime Update
```bash
# Build new image
docker compose build app

# Start new container
docker compose up -d --no-deps app

# Old container automatically replaced
```

## Scaling

### Run Multiple App Instances

Edit `docker-compose.yml`:
```yaml
app:
  deploy:
    replicas: 3
```

Use a load balancer (nginx/haproxy) in front.

## Support

For issues, check:
1. Service logs: `docker-compose logs -f`
2. Container status: `docker-compose ps`
3. Resource usage: `docker stats`
4. Network connectivity: `docker network inspect isp-manager_isp-network`

## Useful Commands Reference

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f [service_name]

# Restart service
docker-compose restart [service_name]

# Execute command in container
docker-compose exec [service_name] [command]

# Access shell in container
docker-compose exec app sh
docker-compose exec postgres sh
docker-compose exec freeradius sh

# Remove all containers and volumes
docker-compose down -v

# Rebuild without cache
docker-compose build --no-cache

# Scale service
docker-compose up -d --scale app=3
```

## License

See main README.md for license information.
