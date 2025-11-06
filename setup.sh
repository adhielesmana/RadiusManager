#!/bin/bash
set -e

# ISP Manager - Initial Setup Script
# This script prepares a new development server for ISP Manager deployment

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Show help message
show_help() {
    echo "ISP Manager - Setup Script"
    echo ""
    echo "Usage: ./setup.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --domain DOMAIN          Domain name for SSL/HTTPS (e.g., isp.example.com)"
    echo "  --email EMAIL            Email for Let's Encrypt notifications"
    echo "  --staging                Use Let's Encrypt staging server (for testing)"
    echo "  --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./setup.sh                                    # Local development (no SSL)"
    echo "  ./setup.sh --domain isp.example.com --email admin@example.com"
    echo "  ./setup.sh --domain test.example.com --email admin@example.com --staging"
    echo ""
}

# Main setup function
main() {
    # Parse command line arguments
    SSL_DOMAIN=""
    SSL_EMAIL=""
    SSL_STAGING="false"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                SSL_DOMAIN="$2"
                shift 2
                ;;
            --email)
                SSL_EMAIL="$2"
                shift 2
                ;;
            --staging)
                SSL_STAGING="true"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Validate SSL configuration
    if [ -n "$SSL_DOMAIN" ] && [ -z "$SSL_EMAIL" ]; then
        print_error "Email is required when using --domain"
        print_info "Use: ./setup.sh --domain $SSL_DOMAIN --email your@email.com"
        exit 1
    fi
    
    if [ -z "$SSL_DOMAIN" ] && [ -n "$SSL_EMAIL" ]; then
        print_error "Domain is required when using --email"
        print_info "Use: ./setup.sh --domain your-domain.com --email $SSL_EMAIL"
        exit 1
    fi
    
    print_header "ISP Manager - Development Server Setup"
    
    # Show SSL status
    if [ -n "$SSL_DOMAIN" ]; then
        print_info "SSL Mode: ENABLED"
        print_info "Domain: $SSL_DOMAIN"
        print_info "Email: $SSL_EMAIL"
        print_info "Staging: $SSL_STAGING"
    else
        print_info "SSL Mode: DISABLED (Local development)"
    fi
    echo ""
    
    # Check operating system
    print_info "Detecting operating system..."
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        print_success "Linux detected"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        print_success "macOS detected"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    
    # Check Docker
    print_header "Checking Docker Installation"
    if command_exists docker; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker is installed: $DOCKER_VERSION"
    else
        print_warning "Docker is not installed"
        read -p "Do you want to install Docker now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_docker
        else
            print_error "Docker is required. Please install it manually from https://docs.docker.com/get-docker/"
            exit 1
        fi
    fi
    
    # Check Docker Compose
    print_header "Checking Docker Compose"
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version)
        print_success "Docker Compose is installed: $COMPOSE_VERSION"
    else
        print_error "Docker Compose is required but not found"
        print_info "Please install Docker Compose V2 from https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    # Check if Docker daemon is running
    print_header "Checking Docker Daemon"
    if docker info >/dev/null 2>&1; then
        print_success "Docker daemon is running"
    else
        print_error "Docker daemon is not running"
        print_info "Please start Docker daemon and try again"
        exit 1
    fi
    
    # Check for existing Nginx
    print_header "Checking for Existing Web Server"
    EXISTING_NGINX=false
    USE_EXISTING_NGINX=false
    
    if check_port_in_use 80 || check_port_in_use 443; then
        print_warning "Ports 80 and/or 443 are in use"
        
        # Check if it's Nginx
        if command_exists nginx && systemctl is-active --quiet nginx 2>/dev/null; then
            print_info "Detected system Nginx running"
            EXISTING_NGINX=true
            
            if [ -n "$SSL_DOMAIN" ]; then
                echo ""
                print_warning "SSL mode requested, but ports 80/443 are already in use by Nginx"
                print_info "ISP Manager can integrate with your existing Nginx!"
                echo ""
                echo "Options:"
                echo "  1. Use existing Nginx (Recommended) - ISP Manager runs on port 5000"
                echo "     We'll generate Nginx config for you to add to your existing setup"
                echo ""
                echo "  2. Skip SSL - Run ISP Manager standalone on port 5000"
                echo ""
                read -p "Use existing Nginx? (y/n) " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    USE_EXISTING_NGINX=true
                    print_success "Will configure for existing Nginx integration"
                else
                    SSL_DOMAIN=""
                    SSL_EMAIL=""
                    SSL_STAGING="false"
                    print_info "SSL disabled - will run on port 5000"
                fi
            fi
        else
            print_warning "Another web server is using ports 80/443"
            if [ -n "$SSL_DOMAIN" ]; then
                print_error "Cannot use SSL mode - ports 80/443 are required"
                print_info "Will configure for local mode on port 5000"
                SSL_DOMAIN=""
                SSL_EMAIL=""
                SSL_STAGING="false"
            fi
        fi
    fi
    
    # Check ports availability
    print_header "Checking Port Availability"
    if [ -n "$SSL_DOMAIN" ] && [ "$USE_EXISTING_NGINX" = false ]; then
        check_port 80 "HTTP (for Let's Encrypt challenges)"
        check_port 443 "HTTPS"
    else
        check_port 5000 "ISP Manager Application"
    fi
    check_port 5432 "PostgreSQL Database"
    check_port 1812 "FreeRADIUS Authentication"
    check_port 1813 "FreeRADIUS Accounting"
    
    # Setup environment file
    print_header "Setting Up Environment Configuration"
    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Do you want to regenerate it? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            setup_env_file
        else
            print_info "Keeping existing .env file"
        fi
    else
        setup_env_file
    fi
    
    # Create necessary directories
    print_header "Creating Required Directories"
    mkdir -p docker/freeradius
    mkdir -p docker/postgres-init
    print_success "Directories created"
    
    # Check if node_modules exists (for development mode)
    if [ -f package.json ]; then
        print_header "Checking Node.js Dependencies"
        if [ -d node_modules ]; then
            print_success "Node modules already installed"
        else
            print_warning "Node modules not found"
            if command_exists npm; then
                read -p "Do you want to install Node.js dependencies for local development? (y/n) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    npm install
                    print_success "Node.js dependencies installed"
                fi
            fi
        fi
    fi
    
    # Final summary
    print_header "Setup Complete!"
    print_success "Your development server is ready for ISP Manager deployment"
    echo ""
    print_info "Next steps:"
    echo "  1. Review and customize the .env file with your settings"
    
    if [ -n "$SSL_DOMAIN" ]; then
        echo "  2. Ensure DNS for ${SSL_DOMAIN} points to this server"
        echo "  3. Run './deploy.sh' to build and start the application"
        echo "  4. Access the application at https://${SSL_DOMAIN}"
    else
        echo "  2. Run './deploy.sh' to build and start the application"
        echo "  3. Access the application at http://localhost:5000"
    fi
    
    echo ""
    print_info "Default credentials:"
    echo "  Username: adhielesmana"
    echo "  Password: admin123"
    echo ""
}

# Install Docker (Linux only)
install_docker() {
    print_info "Installing Docker..."
    
    if [[ "$OS" == "linux" ]]; then
        # Detect Linux distribution
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            DISTRO=$ID
        else
            print_error "Cannot detect Linux distribution"
            exit 1
        fi
        
        case $DISTRO in
            ubuntu|debian)
                sudo apt-get update
                sudo apt-get install -y ca-certificates curl gnupg lsb-release
                sudo mkdir -p /etc/apt/keyrings
                curl -fsSL https://download.docker.com/linux/$DISTRO/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
                echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$DISTRO $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
                sudo apt-get update
                sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
                sudo systemctl start docker
                sudo systemctl enable docker
                print_success "Docker installed successfully"
                ;;
            centos|rhel|fedora)
                sudo yum install -y yum-utils
                sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
                sudo systemctl start docker
                sudo systemctl enable docker
                print_success "Docker installed successfully"
                ;;
            *)
                print_error "Unsupported Linux distribution: $DISTRO"
                print_info "Please install Docker manually from https://docs.docker.com/get-docker/"
                exit 1
                ;;
        esac
        
        # Add current user to docker group
        print_info "Adding current user to docker group..."
        sudo usermod -aG docker $USER
        print_warning "You may need to log out and back in for group changes to take effect"
    else
        print_error "Automatic Docker installation is only supported on Linux"
        print_info "Please install Docker Desktop from https://docs.docker.com/get-docker/"
        exit 1
    fi
}

# Check if a port is in use (returns 0 if in use, 1 if free)
check_port_in_use() {
    local PORT=$1
    
    if command_exists nc; then
        nc -z localhost $PORT 2>/dev/null
        return $?
    elif command_exists lsof; then
        lsof -i:$PORT >/dev/null 2>&1
        return $?
    elif command_exists ss; then
        ss -tuln | grep -q ":$PORT "
        return $?
    else
        # Cannot check, assume not in use
        return 1
    fi
}

# Check if a port is available
check_port() {
    local PORT=$1
    local SERVICE=$2
    
    if check_port_in_use $PORT; then
        print_warning "Port $PORT ($SERVICE) is already in use"
    else
        print_success "Port $PORT ($SERVICE) is available"
    fi
}

# Setup .env file
setup_env_file() {
    print_info "Creating .env file from template..."
    
    if [ ! -f .env.example ]; then
        print_error ".env.example not found"
        exit 1
    fi
    
    cp .env.example .env
    
    # Generate random secrets
    print_info "Generating secure random secrets..."
    
    # Generate DB password (20 characters)
    DB_PASS=$(openssl rand -base64 20 | tr -d "=+/" | cut -c1-20)
    
    # Generate session secret (32 characters)
    SESSION_SEC=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    # Generate RADIUS secret (16 characters)
    RADIUS_SEC=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS requires empty string after -i
        sed -i '' "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASS/" .env
        sed -i '' "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SEC/" .env
        sed -i '' "s/RADIUS_SECRET=.*/RADIUS_SECRET=$RADIUS_SEC/" .env
        
        # Configure SSL if domain provided
        if [ -n "$SSL_DOMAIN" ]; then
            if [ "$USE_EXISTING_NGINX" = true ]; then
                sed -i '' "s/ENABLE_SSL=.*/ENABLE_SSL=existing_nginx/" .env
            else
                sed -i '' "s/ENABLE_SSL=.*/ENABLE_SSL=true/" .env
            fi
            sed -i '' "s/APP_DOMAIN=.*/APP_DOMAIN=$SSL_DOMAIN/" .env
            sed -i '' "s/LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$SSL_EMAIL/" .env
            sed -i '' "s/LE_STAGING=.*/LE_STAGING=$SSL_STAGING/" .env
        fi
    else
        # Linux
        sed -i "s/DB_PASSWORD=.*/DB_PASSWORD=$DB_PASS/" .env
        sed -i "s/SESSION_SECRET=.*/SESSION_SECRET=$SESSION_SEC/" .env
        sed -i "s/RADIUS_SECRET=.*/RADIUS_SECRET=$RADIUS_SEC/" .env
        
        # Configure SSL if domain provided
        if [ -n "$SSL_DOMAIN" ]; then
            if [ "$USE_EXISTING_NGINX" = true ]; then
                sed -i "s/ENABLE_SSL=.*/ENABLE_SSL=existing_nginx/" .env
            else
                sed -i "s/ENABLE_SSL=.*/ENABLE_SSL=true/" .env
            fi
            sed -i "s/APP_DOMAIN=.*/APP_DOMAIN=$SSL_DOMAIN/" .env
            sed -i "s/LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$SSL_EMAIL/" .env
            sed -i "s/LE_STAGING=.*/LE_STAGING=$SSL_STAGING/" .env
        fi
    fi
    
    print_success ".env file created with secure random secrets"
    
    # Show SSL reminder if enabled
    if [ -n "$SSL_DOMAIN" ]; then
        echo ""
        if [ "$USE_EXISTING_NGINX" = true ]; then
            print_warning "EXISTING NGINX INTEGRATION MODE"
            print_info "ISP Manager will run on port 5000 (backend mode)"
            echo ""
            print_info "After deployment, you need to:"
            echo "  1. Run: ./generate-nginx-config.sh"
            echo "  2. Add the generated config to your Nginx"
            echo "  3. Configure SSL certificate for ${SSL_DOMAIN} in your Nginx"
            echo "  4. Reload Nginx: sudo systemctl reload nginx"
            echo ""
        else
            print_warning "SSL/HTTPS is ENABLED (Docker Nginx)"
            print_info "Before deploying, ensure:"
            echo "  1. DNS A/AAAA record for ${SSL_DOMAIN} points to this server's IP"
            echo "  2. Ports 80 and 443 are accessible from the internet"
            echo "  3. No firewall blocking Let's Encrypt validation"
            echo ""
        fi
        print_info "SSL Configuration:"
        echo "  Domain:  ${SSL_DOMAIN}"
        echo "  Email:   ${SSL_EMAIL}"
        echo "  Staging: ${SSL_STAGING}"
        echo ""
    fi
    
    print_info "You can customize the .env file if needed"
}

# Run main function
main "$@"

exit 0
