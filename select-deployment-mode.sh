#!/bin/bash
set -e

# ISP Manager - Deployment Mode Selector
# Helps users choose between Host Nginx (multi-app) and Docker Nginx (single-app) deployment

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

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

clear
print_header "ISP Manager - Deployment Mode Selection"
echo ""

# Check if .env exists, warn if not
if [ ! -f .env ]; then
    print_info ".env file not found - it will be created during deployment"
    echo ""
fi

echo -e "${YELLOW}Choose your deployment mode:${NC}"
echo ""
echo "  ${GREEN}1. Host Nginx (Recommended for Multi-App Servers)${NC}"
echo "     ✓ Nginx installed on host OS (not Docker)"
echo "     ✓ Multiple applications can share one nginx instance"
echo "     ✓ Each app runs in Docker on unique port (5000, 5001, 5002...)"
echo "     ✓ All SSL certs managed on host at /etc/letsencrypt/"
echo "     ✓ Clean separation, easy to manage"
echo ""
echo "     ${BLUE}Best for:${NC}"
echo "       • Servers running multiple applications"
echo "       • Production environments with multiple services"
echo "       • Existing nginx installations"
echo ""

echo "  ${GREEN}2. Docker Nginx (Single-App Deployment)${NC}"
echo "     ✓ Self-contained docker-compose with nginx service"
echo "     ✓ Everything runs in Docker containers"
echo "     ✓ No interaction with other services"
echo "     ✓ Isolated SSL certificates in Docker volumes"
echo ""
echo "     ${BLUE}Best for:${NC}"
echo "       • Dedicated servers running only ISP Manager"
echo "       • Testing/development environments"
echo "       • Quick single-app deployments"
echo ""

read -p "Enter your choice (1 or 2): " CHOICE

case $CHOICE in
    1)
        print_header "Selected: Host Nginx Mode"
        echo ""
        
        # Check if nginx is installed
        if command -v nginx >/dev/null 2>&1; then
            NGINX_VERSION=$(nginx -v 2>&1 | grep -oP 'nginx/\K[0-9.]+' || echo "unknown")
            print_success "Nginx already installed (version: $NGINX_VERSION)"
            echo ""
            
            # Create or update .env
            touch .env
            
            if grep -q "^DEPLOYMENT_MODE=" .env; then
                sed -i 's/^DEPLOYMENT_MODE=.*/DEPLOYMENT_MODE=host_nginx/' .env
            else
                echo "DEPLOYMENT_MODE=host_nginx" >> .env
            fi
            
            # Set ENABLE_SSL to false (host nginx handles SSL)
            if grep -q "^ENABLE_SSL=" .env; then
                sed -i 's/^ENABLE_SSL=.*/ENABLE_SSL=false/' .env
            else
                echo "ENABLE_SSL=false" >> .env
            fi
            
            print_success "Updated .env with DEPLOYMENT_MODE=host_nginx"
        else
            print_info "Nginx not installed on host"
            echo ""
            read -p "Do you want to install nginx now? (Y/n): " INSTALL
            
            if [[ ! $INSTALL =~ ^[Nn]$ ]]; then
                print_info "Running install-host-nginx.sh..."
                echo ""
                chmod +x install-host-nginx.sh
                ./install-host-nginx.sh
            else
                print_warning "Please install nginx manually before deploying"
                echo ""
                echo "You can run: ./install-host-nginx.sh"
            fi
        fi
        
        echo ""
        print_header "Next Steps"
        echo ""
        echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
        echo "  2. Run: ./deploy.sh"
        echo "  3. SSL certificates will be obtained automatically via certbot"
        echo ""
        ;;
        
    2)
        print_header "Selected: Docker Nginx Mode"
        echo ""
        
        # Create or update .env
        touch .env
        
        if grep -q "^DEPLOYMENT_MODE=" .env; then
            sed -i 's/^DEPLOYMENT_MODE=.*/DEPLOYMENT_MODE=docker_nginx/' .env
        else
            echo "DEPLOYMENT_MODE=docker_nginx" >> .env
        fi
        
        # Ensure ENABLE_SSL is set for docker nginx mode
        if grep -q "^ENABLE_SSL=" .env; then
            sed -i 's/^ENABLE_SSL=.*/ENABLE_SSL=true/' .env
        else
            echo "ENABLE_SSL=true" >> .env
        fi
        
        print_success "Updated .env with DEPLOYMENT_MODE=docker_nginx"
        
        echo ""
        print_header "Next Steps"
        echo ""
        echo "  1. Run: ./setup.sh --domain your-domain.com --email your@email.com"
        echo "  2. Run: ./deploy.sh"
        echo "  3. Docker Compose will start nginx container with SSL"
        echo ""
        ;;
        
    *)
        print_error "Invalid choice. Please run the script again and choose 1 or 2."
        exit 1
        ;;
esac

echo ""
print_info "Deployment mode configured successfully!"
echo ""
