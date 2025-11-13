#!/bin/bash
set -e

# ISP Manager - Host Nginx Installation Script
# This script installs and configures nginx on the host OS (not Docker)
# Designed for multi-app servers where multiple applications share one nginx instance

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    elif command_exists lsb_release; then
        OS=$(lsb_release -si | tr '[:upper:]' '[:lower:]')
        VER=$(lsb_release -sr)
    else
        OS=$(uname -s | tr '[:upper:]' '[:lower:]')
        VER=""
    fi
}

print_header "Installing Nginx on Host"
echo ""

# Detect OS
detect_os
print_info "Detected OS: $OS $VER"
echo ""

# Check if nginx is already installed
if command_exists nginx; then
    NGINX_VERSION=$(nginx -v 2>&1 | grep -oP 'nginx/\K[0-9.]+' || echo "unknown")
    print_warning "Nginx is already installed (version: $NGINX_VERSION)"
    echo ""
    read -p "Do you want to continue and reconfigure it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Installation cancelled"
        exit 0
    fi
    NGINX_ALREADY_INSTALLED=true
else
    NGINX_ALREADY_INSTALLED=false
fi

# Install nginx based on OS
print_header "Installing Nginx Package"
echo ""

case "$OS" in
    ubuntu|debian)
        print_info "Installing nginx on Debian/Ubuntu..."
        apt-get update
        apt-get install -y nginx
        ;;
    centos|rhel|rocky|almalinux)
        print_info "Installing nginx on RHEL/CentOS..."
        yum install -y epel-release
        yum install -y nginx
        ;;
    fedora)
        print_info "Installing nginx on Fedora..."
        dnf install -y nginx
        ;;
    *)
        print_error "Unsupported OS: $OS"
        echo ""
        echo "Please install nginx manually and run this script again."
        exit 1
        ;;
esac

print_success "Nginx package installed"
echo ""

# Install certbot for SSL
print_header "Installing Certbot for SSL Certificates"
echo ""

if ! command_exists certbot; then
    case "$OS" in
        ubuntu|debian)
            apt-get install -y certbot python3-certbot-nginx
            ;;
        centos|rhel|rocky|almalinux|fedora)
            if [ "$OS" = "fedora" ]; then
                dnf install -y certbot python3-certbot-nginx
            else
                yum install -y certbot python3-certbot-nginx
            fi
            ;;
    esac
    print_success "Certbot installed"
else
    print_info "Certbot already installed"
fi
echo ""

# Enable and start nginx
print_header "Configuring Nginx Service"
echo ""

systemctl enable nginx
if systemctl is-active --quiet nginx; then
    print_info "Nginx is already running"
else
    systemctl start nginx
    print_success "Nginx service started"
fi

# Check if nginx is listening on ports 80 and 443
if ss -tuln | grep -q ':80 '; then
    print_success "Nginx listening on port 80"
else
    print_warning "Nginx not listening on port 80"
fi

if ss -tuln | grep -q ':443 '; then
    print_success "Nginx listening on port 443"
else
    print_info "Nginx not listening on port 443 (will be available after SSL setup)"
fi

echo ""

# Configure firewall (if firewalld is active)
if systemctl is-active --quiet firewalld; then
    print_header "Configuring Firewall"
    echo ""
    
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
    
    print_success "Firewall configured (HTTP and HTTPS allowed)"
    echo ""
fi

# Test nginx configuration
print_header "Testing Nginx Configuration"
echo ""

if nginx -t 2>&1; then
    print_success "Nginx configuration is valid"
else
    print_error "Nginx configuration test failed!"
    exit 1
fi

echo ""

# Create directory for site configurations
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled

# Check if sites-enabled is included in nginx.conf
if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
    print_info "Adding sites-enabled include to nginx.conf..."
    
    # Backup nginx.conf
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup-$(date +%Y%m%d-%H%M%S)
    
    # Add include directive in http block
    sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
    
    print_success "Added sites-enabled include"
    echo ""
fi

# Reload nginx
systemctl reload nginx
print_success "Nginx configuration reloaded"
echo ""

print_header "Host Nginx Installation Complete!"
echo ""
print_success "Nginx is installed and running on the host"
print_info "Site configurations will be placed in: /etc/nginx/sites-available/"
print_info "Enabled sites will be symlinked to: /etc/nginx/sites-enabled/"
echo ""
print_info "Next steps:"
echo "  1. Run ./deploy.sh to deploy ISP Manager"
echo "  2. The deployment will generate nginx site config automatically"
echo "  3. SSL certificates will be obtained via certbot"
echo ""
