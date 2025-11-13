#!/bin/bash
set -e

# ISP Manager - Certbot Installation Script
# Automatically installs certbot for SSL certificate management on host systems

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Check if running with appropriate privileges
check_privileges() {
    if [ "$EUID" -ne 0 ]; then
        print_error "This script requires root privileges to install packages"
        echo ""
        echo "Please run with appropriate privileges:"
        echo "  sudo $0"
        echo ""
        exit 1
    fi
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    elif command -v lsb_release &> /dev/null; then
        OS=$(lsb_release -si | tr '[:upper:]' '[:lower:]')
        VER=$(lsb_release -sr)
    else
        OS=$(uname -s | tr '[:upper:]' '[:lower:]')
        VER=""
    fi
}

print_header "Installing Certbot for SSL Certificates"

# Check privileges
check_privileges

# Detect OS
detect_os
print_info "Detected OS: $OS $VER"
echo ""

# Check if certbot is already installed
if command -v certbot &> /dev/null; then
    CERTBOT_VERSION=$(certbot --version 2>&1 | grep -oP 'certbot \K[0-9.]+' || echo "unknown")
    print_success "Certbot is already installed (version: $CERTBOT_VERSION)"
    exit 0
fi

# Install certbot based on OS
print_info "Installing certbot..."
echo ""

case "$OS" in
    ubuntu|debian)
        print_info "Installing certbot on Debian/Ubuntu..."
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
        ;;
    centos|rhel|rocky|almalinux)
        print_info "Installing certbot on RHEL/CentOS..."
        yum install -y epel-release
        yum install -y certbot python3-certbot-nginx
        ;;
    fedora)
        print_info "Installing certbot on Fedora..."
        dnf install -y certbot python3-certbot-nginx
        ;;
    *)
        print_error "Unsupported OS: $OS"
        echo ""
        echo "Please install certbot manually:"
        echo "  Ubuntu/Debian: apt-get install certbot python3-certbot-nginx"
        echo "  RHEL/CentOS:   yum install certbot python3-certbot-nginx"
        echo "  Fedora:        dnf install certbot python3-certbot-nginx"
        exit 1
        ;;
esac

echo ""
print_success "Certbot installation complete!"
echo ""

# Verify installation
if command -v certbot &> /dev/null; then
    CERTBOT_VERSION=$(certbot --version 2>&1 | grep -oP 'certbot \K[0-9.]+' || echo "unknown")
    print_success "Certbot version: $CERTBOT_VERSION"
else
    print_error "Certbot installation failed"
    exit 1
fi

echo ""
print_info "Certbot is ready for SSL certificate management"
print_info "Certificates will be obtained automatically during deployment"
echo ""
