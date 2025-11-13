#!/bin/bash
set -e

# =============================================================================
# ISP Manager - Setup Script
# Installs nginx, certbot, Docker, and configures environment
# =============================================================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

main() {
    # Parse arguments
    APP_DOMAIN=""
    APP_EMAIL=""
    AUTO_MODE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain) APP_DOMAIN="$2"; shift 2 ;;
            --email) APP_EMAIL="$2"; shift 2 ;;
            --auto) AUTO_MODE=true; shift ;;
            --help)
                echo "Usage: sudo ./setup.sh [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --domain DOMAIN    Set domain name"
                echo "  --email EMAIL      Set email for SSL"
                echo "  --auto             Non-interactive mode (for deploy.sh)"
                echo ""
                echo "Example: sudo ./setup.sh --domain isp.example.com --email admin@example.com"
                exit 0
                ;;
            *) print_error "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    # Only clear screen if not in auto mode
    if [ "$AUTO_MODE" = false ]; then
        clear
    fi
    
    print_header "ISP Manager - Setup"
    
    # Check if we have permission to install packages
    if [ "$EUID" -ne 0 ]; then
        print_warning "Not running as root - some operations may fail"
        print_info "If installation fails, try: sudo ./setup.sh"
        echo ""
    fi
    
    # Detect OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
    else
        print_error "Cannot detect OS"
        exit 1
    fi
    
    # Install nginx
    print_header "Step 1/5: Nginx Setup"
    if command_exists nginx; then
        print_success "Nginx already installed"
        systemctl is-active --quiet nginx || systemctl start nginx
    else
        print_info "Installing nginx..."
        case "$OS" in
            ubuntu|debian)
                apt-get update -qq
                apt-get install -y nginx
                ;;
            centos|rhel|rocky|almalinux)
                yum install -y epel-release nginx
                ;;
            fedora)
                dnf install -y nginx
                ;;
            *)
                print_error "Unsupported OS: $OS"
                exit 1
                ;;
        esac
        
        systemctl enable nginx
        systemctl start nginx
        mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled
        
        if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
            sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
        fi
        
        systemctl reload nginx
        print_success "Nginx installed"
    fi
    
    # Install certbot with nginx plugin
    print_header "Step 2/5: Certbot Setup"
    
    CERTBOT_NGINX_INSTALLED=false
    
    # Check if certbot is installed
    if command_exists certbot; then
        print_success "Certbot is installed"
        
        # Check if nginx plugin is available
        if certbot plugins 2>/dev/null | grep -q "nginx"; then
            print_success "Certbot nginx plugin is installed"
            CERTBOT_NGINX_INSTALLED=true
        else
            print_warning "Certbot nginx plugin is missing"
        fi
    else
        print_info "Certbot not found"
    fi
    
    # Install certbot and/or nginx plugin if needed
    if [ "$CERTBOT_NGINX_INSTALLED" = false ]; then
        print_info "Installing certbot with nginx plugin..."
        case "$OS" in
            ubuntu|debian)
                apt-get update -qq
                apt-get install -y certbot python3-certbot-nginx
                ;;
            centos|rhel|rocky|almalinux)
                yum install -y certbot python3-certbot-nginx
                ;;
            fedora)
                dnf install -y certbot python3-certbot-nginx
                ;;
        esac
        
        # Verify installation
        if certbot plugins 2>/dev/null | grep -q "nginx"; then
            print_success "Certbot with nginx plugin installed successfully"
        else
            print_error "Failed to install certbot nginx plugin"
            exit 1
        fi
    fi
    
    # Install Docker
    print_header "Step 3/5: Docker Setup"
    if command_exists docker && docker info >/dev/null 2>&1; then
        print_success "Docker already installed"
    else
        print_info "Installing Docker..."
        case "$OS" in
            ubuntu|debian)
                apt-get install -y docker.io docker-compose-plugin
                ;;
            centos|rhel|rocky|almalinux|fedora)
                yum install -y docker docker-compose-plugin
                ;;
        esac
        
        systemctl enable docker
        systemctl start docker
        print_success "Docker installed"
    fi
    
    # Configure .env
    print_header "Step 4/5: Environment Configuration"
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_success "Created .env file"
        else
            print_error ".env.example not found"
            exit 1
        fi
    fi
    
    # Set deployment mode
    if grep -q "^DEPLOYMENT_MODE=" .env; then
        sed -i "s/^DEPLOYMENT_MODE=.*/DEPLOYMENT_MODE=host_nginx/" .env
    else
        echo "DEPLOYMENT_MODE=host_nginx" >> .env
    fi
    
    if grep -q "^USE_DOCKER_COMPOSE_SSL=" .env; then
        sed -i "s/^USE_DOCKER_COMPOSE_SSL=.*/USE_DOCKER_COMPOSE_SSL=false/" .env
    else
        echo "USE_DOCKER_COMPOSE_SSL=false" >> .env
    fi
    
    if grep -q "^ENABLE_SSL=" .env; then
        sed -i "s/^ENABLE_SSL=.*/ENABLE_SSL=true/" .env
    else
        echo "ENABLE_SSL=true" >> .env
    fi
    
    # Find available port
    APP_PORT=5000
    while ss -tuln 2>/dev/null | grep -q ":$APP_PORT "; do
        ((APP_PORT++))
    done
    sed -i "s/^APP_HOST_PORT=.*/APP_HOST_PORT=$APP_PORT/" .env
    
    # Set domain and email
    if [ -n "$APP_DOMAIN" ]; then
        sed -i "s/^APP_DOMAIN=.*/APP_DOMAIN=$APP_DOMAIN/" .env
    fi
    
    if [ -n "$APP_EMAIL" ]; then
        sed -i "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$APP_EMAIL/" .env
    fi
    
    print_success "Environment configured"
    
    # Summary (skip in auto mode)
    if [ "$AUTO_MODE" = false ]; then
        print_header "Setup Complete!"
        
        echo ""
        print_success "✓ Nginx installed and running"
        print_success "✓ Certbot installed for SSL"
        print_success "✓ Docker installed"
        print_success "✓ Environment configured"
        echo ""
        
        print_info "Configuration:"
        echo "  • Deployment Mode: Host Nginx"
        echo "  • App Port: $APP_PORT"
        [ -n "$APP_DOMAIN" ] && echo "  • Domain: $APP_DOMAIN"
        [ -n "$APP_EMAIL" ] && echo "  • Email: $APP_EMAIL"
        echo ""
        
        print_info "Next step:"
        echo "  Run: ./deploy.sh"
        echo ""
    fi
}

main "$@"
