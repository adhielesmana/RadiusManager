#!/bin/bash
set -e

# =============================================================================
# ISP Manager - Simple Setup Script
# For fresh installations - detects/installs nginx, configures SSL automatically
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

# =============================================================================
# MAIN SETUP
# =============================================================================

main() {
    clear
    print_header "ISP Manager - Simple Setup"
    
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
                echo "Usage: ./setup.sh --domain DOMAIN --email EMAIL"
                echo ""
                echo "Example: ./setup.sh --domain isp.example.com --email admin@example.com"
                exit 0
                ;;
            *) print_error "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    # Require root for installations
    if [ "$EUID" -ne 0 ] && [ "$AUTO_MODE" = false ]; then
        print_warning "This script needs root access to install packages"
        print_info "Please run: sudo ./setup.sh --domain $APP_DOMAIN --email $APP_EMAIL"
        exit 1
    fi
    
    # =========================================================================
    # STEP 1: DETECT/INSTALL NGINX
    # =========================================================================
    
    print_header "Step 1/5: Nginx Setup"
    
    if command_exists nginx; then
        NGINX_VERSION=$(nginx -v 2>&1 | grep -oP 'nginx/\K[0-9.]+')
        print_success "Nginx already installed (version $NGINX_VERSION)"
        
        # Make sure it's running
        if ! systemctl is-active --quiet nginx; then
            print_info "Starting nginx..."
            systemctl start nginx
        fi
    else
        print_info "Installing nginx..."
        
        # Detect OS
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$ID
        else
            print_error "Cannot detect OS"
            exit 1
        fi
        
        # Install nginx
        case "$OS" in
            ubuntu|debian)
                apt-get update -qq
                apt-get install -y nginx
                ;;
            centos|rhel|rocky|almalinux)
                yum install -y epel-release
                yum install -y nginx
                ;;
            fedora)
                dnf install -y nginx
                ;;
            *)
                print_error "Unsupported OS: $OS"
                exit 1
                ;;
        esac
        
        # Configure nginx
        systemctl enable nginx
        systemctl start nginx
        
        # Create sites directories
        mkdir -p /etc/nginx/sites-available
        mkdir -p /etc/nginx/sites-enabled
        
        # Add sites-enabled include
        if ! grep -q "sites-enabled" /etc/nginx/nginx.conf; then
            sed -i '/http {/a \    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf
        fi
        
        systemctl reload nginx
        print_success "Nginx installed and configured"
    fi
    
    # =========================================================================
    # STEP 2: INSTALL CERTBOT
    # =========================================================================
    
    print_header "Step 2/5: Certbot Setup"
    
    if command_exists certbot; then
        print_success "Certbot already installed"
    else
        print_info "Installing certbot for SSL..."
        
        case "$OS" in
            ubuntu|debian)
                apt-get install -y certbot python3-certbot-nginx
                ;;
            centos|rhel|rocky|almalinux)
                yum install -y certbot python3-certbot-nginx
                ;;
            fedora)
                dnf install -y certbot python3-certbot-nginx
                ;;
        esac
        
        print_success "Certbot installed"
    fi
    
    # =========================================================================
    # STEP 3: INSTALL DOCKER
    # =========================================================================
    
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
    
    # =========================================================================
    # STEP 4: CONFIGURE ENVIRONMENT
    # =========================================================================
    
    print_header "Step 4/5: Environment Configuration"
    
    # Create .env from example
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_success "Created .env file"
        else
            print_error ".env.example not found"
            exit 1
        fi
    fi
    
    # Set deployment mode to host_nginx
    sed -i "s/^DEPLOYMENT_MODE=.*/DEPLOYMENT_MODE=host_nginx/" .env
    sed -i "s/^USE_DOCKER_COMPOSE_SSL=.*/USE_DOCKER_COMPOSE_SSL=false/" .env
    sed -i "s/^ENABLE_SSL=.*/ENABLE_SSL=true/" .env
    
    # Find available port for app (avoid 80, 443 used by nginx)
    APP_PORT=5000
    while ss -tuln 2>/dev/null | grep -q ":$APP_PORT "; do
        ((APP_PORT++))
    done
    sed -i "s/^APP_HOST_PORT=.*/APP_HOST_PORT=$APP_PORT/" .env
    print_info "Application will run on port $APP_PORT"
    
    # Set domain if provided
    if [ -n "$APP_DOMAIN" ]; then
        sed -i "s/^APP_DOMAIN=.*/APP_DOMAIN=$APP_DOMAIN/" .env
        print_info "Domain: $APP_DOMAIN"
    fi
    
    # Set email if provided
    if [ -n "$APP_EMAIL" ]; then
        sed -i "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$APP_EMAIL/" .env
        print_info "Email: $APP_EMAIL"
    fi
    
    print_success "Environment configured"
    
    # =========================================================================
    # STEP 5: SUMMARY
    # =========================================================================
    
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
    if [ -n "$APP_DOMAIN" ]; then
        echo "  • Domain: $APP_DOMAIN"
    fi
    if [ -n "$APP_EMAIL" ]; then
        echo "  • Email: $APP_EMAIL"
    fi
    echo ""
    
    print_info "Next steps:"
    echo "  1. Run: ./deploy.sh"
    echo "  2. SSL will be configured automatically"
    echo "  3. Your app will be available at: https://$APP_DOMAIN"
    echo ""
}

main "$@"
