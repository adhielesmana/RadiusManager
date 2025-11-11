#!/bin/bash
set -e

# ISP Manager - Automated Setup Script
# This script automatically handles port conflicts and deployment issues

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
    echo "ISP Manager - Automated Setup Script"
    echo ""
    echo "Usage: ./setup.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --domain DOMAIN          Domain name for SSL/HTTPS (e.g., isp.example.com)"
    echo "  --email EMAIL            Email for Let's Encrypt notifications"
    echo "  --staging                Use Let's Encrypt staging server (for testing)"
    echo "  --auto                   Fully automated mode (no prompts)"
    echo "  --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./setup.sh                                    # Interactive setup"
    echo "  ./setup.sh --auto                            # Fully automated (no prompts)"
    echo "  ./setup.sh --domain isp.example.com --email admin@example.com"
    echo "  ./setup.sh --domain test.example.com --email admin@example.com --staging"
    echo ""
}

# Find an available port starting from a given port, avoiding reserved ports
find_available_port() {
    local START_PORT=$1
    local RESERVED_PORTS="$2"  # Space-separated list of ports to avoid
    local MAX_ATTEMPTS=200
    local PORT=$START_PORT
    
    for ((i=0; i<MAX_ATTEMPTS; i++)); do
        # Check if port is in reserved list
        local IS_RESERVED=false
        for RESERVED in $RESERVED_PORTS; do
            if [ "$PORT" = "$RESERVED" ]; then
                IS_RESERVED=true
                break
            fi
        done
        
        # If not reserved and not in use, we found our port
        if [ "$IS_RESERVED" = false ] && ! check_port_in_use $PORT; then
            echo $PORT
            return 0
        fi
        PORT=$((PORT + 1))
    done
    
    # If we couldn't find a port after 200 attempts, fail
    print_error "Could not find available port after $MAX_ATTEMPTS attempts starting from $START_PORT"
    return 1
}

# Automatically resolve port conflicts and update .env
auto_resolve_ports() {
    print_header "Automatic Port Conflict Resolution"
    
    local PORTS_CHANGED=false
    local CHANGES_LOG=""
    local RESERVED_PORTS=""  # Track all ports we've assigned to avoid duplicates
    
    # Check and resolve APP_HOST_PORT
    local APP_PORT=$(grep "^APP_HOST_PORT=" .env | cut -d'=' -f2)
    if check_port_in_use $APP_PORT; then
        print_warning "Port $APP_PORT (Application) is in use"
        local NEW_PORT=$(find_available_port $((APP_PORT + 1)) "$RESERVED_PORTS")
        if [ $? -eq 0 ]; then
            update_env_port "APP_HOST_PORT" $NEW_PORT
            RESERVED_PORTS="$RESERVED_PORTS $NEW_PORT"
            CHANGES_LOG="${CHANGES_LOG}  • Application: $APP_PORT → $NEW_PORT\n"
            PORTS_CHANGED=true
            print_success "Changed to port $NEW_PORT"
        else
            print_error "Failed to find available port for Application"
            exit 1
        fi
    else
        RESERVED_PORTS="$RESERVED_PORTS $APP_PORT"
        print_success "Port $APP_PORT (Application) is available"
    fi
    
    # Check and resolve POSTGRES_HOST_PORT
    local POSTGRES_PORT=$(grep "^POSTGRES_HOST_PORT=" .env | cut -d'=' -f2)
    if check_port_in_use $POSTGRES_PORT; then
        print_warning "Port $POSTGRES_PORT (PostgreSQL) is in use"
        local NEW_PORT=$(find_available_port $((POSTGRES_PORT + 1)) "$RESERVED_PORTS")
        if [ $? -eq 0 ]; then
            update_env_port "POSTGRES_HOST_PORT" $NEW_PORT
            RESERVED_PORTS="$RESERVED_PORTS $NEW_PORT"
            CHANGES_LOG="${CHANGES_LOG}  • PostgreSQL: $POSTGRES_PORT → $NEW_PORT\n"
            PORTS_CHANGED=true
            print_success "Changed to port $NEW_PORT"
        else
            print_error "Failed to find available port for PostgreSQL"
            exit 1
        fi
    else
        RESERVED_PORTS="$RESERVED_PORTS $POSTGRES_PORT"
        print_success "Port $POSTGRES_PORT (PostgreSQL) is available"
    fi
    
    # Check and resolve RADIUS_AUTH_PORT
    local RADIUS_AUTH=$(grep "^RADIUS_AUTH_PORT=" .env | cut -d'=' -f2)
    if check_port_in_use $RADIUS_AUTH; then
        print_warning "Port $RADIUS_AUTH (RADIUS Auth) is in use"
        local NEW_PORT=$(find_available_port $((RADIUS_AUTH + 1)) "$RESERVED_PORTS")
        if [ $? -eq 0 ]; then
            update_env_port "RADIUS_AUTH_PORT" $NEW_PORT
            RESERVED_PORTS="$RESERVED_PORTS $NEW_PORT"
            CHANGES_LOG="${CHANGES_LOG}  • RADIUS Auth: $RADIUS_AUTH → $NEW_PORT\n"
            PORTS_CHANGED=true
            print_success "Changed to port $NEW_PORT"
        else
            print_error "Failed to find available port for RADIUS Auth"
            exit 1
        fi
    else
        RESERVED_PORTS="$RESERVED_PORTS $RADIUS_AUTH"
        print_success "Port $RADIUS_AUTH (RADIUS Auth) is available"
    fi
    
    # Check and resolve RADIUS_ACCT_PORT
    local RADIUS_ACCT=$(grep "^RADIUS_ACCT_PORT=" .env | cut -d'=' -f2)
    # Always check for collision with previously assigned ports
    local PORT_COLLISION=false
    for RESERVED in $RESERVED_PORTS; do
        if [ "$RADIUS_ACCT" = "$RESERVED" ]; then
            PORT_COLLISION=true
            break
        fi
    done
    
    if check_port_in_use $RADIUS_ACCT || [ "$PORT_COLLISION" = true ]; then
        if [ "$PORT_COLLISION" = true ]; then
            print_warning "Port $RADIUS_ACCT (RADIUS Acct) conflicts with previously assigned port"
        else
            print_warning "Port $RADIUS_ACCT (RADIUS Acct) is in use"
        fi
        local NEW_PORT=$(find_available_port $((RADIUS_ACCT + 1)) "$RESERVED_PORTS")
        if [ $? -eq 0 ]; then
            update_env_port "RADIUS_ACCT_PORT" $NEW_PORT
            RESERVED_PORTS="$RESERVED_PORTS $NEW_PORT"
            CHANGES_LOG="${CHANGES_LOG}  • RADIUS Acct: $RADIUS_ACCT → $NEW_PORT\n"
            PORTS_CHANGED=true
            print_success "Changed to port $NEW_PORT"
        else
            print_error "Failed to find available port for RADIUS Acct"
            exit 1
        fi
    else
        RESERVED_PORTS="$RESERVED_PORTS $RADIUS_ACCT"
        print_success "Port $RADIUS_ACCT (RADIUS Acct) is available"
    fi
    
    # Check SSL ports if enabled
    local ENABLE_SSL=$(grep "^ENABLE_SSL=" .env | cut -d'=' -f2)
    if [ "$ENABLE_SSL" = "true" ]; then
        local HTTP_PORT=$(grep "^HTTP_PORT=" .env | cut -d'=' -f2)
        local HTTPS_PORT=$(grep "^HTTPS_PORT=" .env | cut -d'=' -f2)
        
        if check_port_in_use $HTTP_PORT; then
            print_warning "Port $HTTP_PORT (HTTP) is in use - SSL mode may not work"
            print_info "Consider using --auto to disable SSL or free port 80"
        else
            print_success "Port $HTTP_PORT (HTTP) is available"
        fi
        
        if check_port_in_use $HTTPS_PORT; then
            print_warning "Port $HTTPS_PORT (HTTPS) is in use - SSL mode may not work"
            print_info "Consider using --auto to disable SSL or free port 443"
        else
            print_success "Port $HTTPS_PORT (HTTPS) is available"
        fi
    fi
    
    # Show summary of changes
    if [ "$PORTS_CHANGED" = true ]; then
        echo ""
        print_warning "Port conflicts detected and automatically resolved!"
        echo -e "${YELLOW}Changed Ports:${NC}"
        echo -e "$CHANGES_LOG"
        print_success ".env file updated automatically"
        echo ""
    else
        echo ""
        print_success "All ports are available - no conflicts detected!"
        echo ""
    fi
}

# Update a port in .env file
update_env_port() {
    local KEY=$1
    local VALUE=$2
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^${KEY}=.*/${KEY}=${VALUE}/" .env
    else
        sed -i "s/^${KEY}=.*/${KEY}=${VALUE}/" .env
    fi
}

# Interactive SSL configuration prompt
prompt_for_ssl_configuration() {
    # Only prompt if not in auto mode and no --domain flag provided
    if [ "$AUTO_MODE" = true ] || [ -n "$SSL_DOMAIN" ]; then
        return
    fi
    
    print_header "SSL/HTTPS Configuration"
    echo ""
    echo "Do you want to enable SSL/HTTPS with your own domain?"
    echo ""
    echo -e "${GREEN}Benefits of enabling SSL:${NC}"
    echo "  • Secure HTTPS connection with Let's Encrypt certificate"
    echo "  • Automatic certificate renewal"
    echo "  • Professional custom domain (e.g., https://isp.yourcompany.com)"
    echo ""
    echo -e "${YELLOW}Requirements:${NC}"
    echo "  • A domain name that you own"
    echo "  • DNS A record pointing to this server's IP"
    echo "  • Ports 80 and 443 must be available"
    echo ""
    echo -e "${BLUE}Note:${NC} You can also run without SSL for local development (http://localhost:5000)"
    echo ""
    
    read -p "Enable SSL/HTTPS? (y/n) " -n 1 -r
    echo
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Check if ports 80/443 are available before asking for domain
        if check_port_in_use 80 || check_port_in_use 443; then
            print_warning "Ports 80 and/or 443 are currently in use"
            
            # Check if it's Nginx
            if command_exists nginx && systemctl is-active --quiet nginx 2>/dev/null; then
                print_info "Detected system Nginx running on ports 80/443"
                echo ""
                echo "ISP Manager can integrate with your existing Nginx!"
                echo "We'll run on port 5000 and generate Nginx config for you."
                echo ""
                read -p "Use existing Nginx? (y/n) " -n 1 -r
                echo
                
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    USE_EXISTING_NGINX=true
                else
                    print_info "SSL disabled - will run in local mode on port 5000"
                    return
                fi
            else
                print_error "Cannot enable SSL - ports 80/443 are required but in use"
                print_info "Will run in local mode on port 5000"
                return
            fi
        fi
        
        # Prompt for domain
        while true; do
            read -p "Enter your domain name (e.g., isp.yourcompany.com): " SSL_DOMAIN
            if [ -n "$SSL_DOMAIN" ]; then
                break
            fi
            print_error "Domain name cannot be empty"
        done
        
        # Prompt for email
        while true; do
            read -p "Enter your email for Let's Encrypt notifications: " SSL_EMAIL
            if [ -n "$SSL_EMAIL" ]; then
                break
            fi
            print_error "Email address cannot be empty"
        done
        
        # Prompt for staging mode
        echo ""
        echo -e "${YELLOW}Testing mode (optional):${NC}"
        echo "Let's Encrypt has rate limits. Use staging mode for testing."
        echo "Staging certificates won't be trusted by browsers, but perfect for testing."
        echo ""
        read -p "Use staging mode for testing? (y/n) " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            SSL_STAGING="true"
        else
            SSL_STAGING="false"
        fi
        
        echo ""
        print_success "SSL configuration saved!"
        print_info "Domain: $SSL_DOMAIN"
        print_info "Email:  $SSL_EMAIL"
        print_info "Staging: $SSL_STAGING"
        echo ""
    else
        print_info "SSL disabled - will run in local development mode"
    fi
}

# Apply SSL settings to .env file
apply_ssl_settings_to_env() {
    if [ ! -f .env ]; then
        return
    fi
    
    if [ -n "$SSL_DOMAIN" ]; then
        print_info "Applying SSL configuration to .env file..."
        
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            if [ "$USE_EXISTING_NGINX" = true ]; then
                sed -i '' "s/^ENABLE_SSL=.*/ENABLE_SSL=existing_nginx/" .env
            else
                sed -i '' "s/^ENABLE_SSL=.*/ENABLE_SSL=true/" .env
            fi
            sed -i '' "s/^APP_DOMAIN=.*/APP_DOMAIN=$SSL_DOMAIN/" .env
            sed -i '' "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$SSL_EMAIL/" .env
            sed -i '' "s/^LE_STAGING=.*/LE_STAGING=$SSL_STAGING/" .env
        else
            # Linux
            if [ "$USE_EXISTING_NGINX" = true ]; then
                sed -i "s/^ENABLE_SSL=.*/ENABLE_SSL=existing_nginx/" .env
            else
                sed -i "s/^ENABLE_SSL=.*/ENABLE_SSL=true/" .env
            fi
            sed -i "s/^APP_DOMAIN=.*/APP_DOMAIN=$SSL_DOMAIN/" .env
            sed -i "s/^LETSENCRYPT_EMAIL=.*/LETSENCRYPT_EMAIL=$SSL_EMAIL/" .env
            sed -i "s/^LE_STAGING=.*/LE_STAGING=$SSL_STAGING/" .env
        fi
        
        print_success "SSL settings applied to .env"
    fi
}

# Main setup function
main() {
    # Parse command line arguments
    SSL_DOMAIN=""
    SSL_EMAIL=""
    SSL_STAGING="false"
    AUTO_MODE=false
    
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
            --auto)
                AUTO_MODE=true
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
    
    print_header "ISP Manager - Automated Setup"
    
    # Show mode
    if [ "$AUTO_MODE" = true ]; then
        print_info "Mode: FULLY AUTOMATED (no prompts)"
    else
        print_info "Mode: INTERACTIVE"
    fi
    
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
    
    # Prompt for SSL configuration if interactive and no CLI flags provided
    prompt_for_ssl_configuration
    
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
        print_error "Docker is not installed"
        if [ "$AUTO_MODE" = true ]; then
            print_error "Cannot install Docker automatically. Please install it manually."
            print_info "Visit: https://docs.docker.com/get-docker/"
            exit 1
        else
            read -p "Do you want to install Docker now? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                install_docker
            else
                print_error "Docker is required. Please install it manually from https://docs.docker.com/get-docker/"
                exit 1
            fi
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
                if [ "$AUTO_MODE" = true ]; then
                    # In auto mode, use existing Nginx
                    USE_EXISTING_NGINX=true
                    print_success "Will integrate with existing Nginx (auto mode)"
                else
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
            fi
        else
            print_warning "Another web server is using ports 80/443"
            if [ -n "$SSL_DOMAIN" ]; then
                if [ "$AUTO_MODE" = true ]; then
                    print_warning "Cannot use SSL in auto mode - ports unavailable"
                    SSL_DOMAIN=""
                    SSL_EMAIL=""
                    SSL_STAGING="false"
                else
                    print_error "Cannot use SSL mode - ports 80/443 are required"
                    print_info "Will configure for local mode on port 5000"
                    SSL_DOMAIN=""
                    SSL_EMAIL=""
                    SSL_STAGING="false"
                fi
            fi
        fi
    fi
    
    # Setup environment file
    print_header "Setting Up Environment Configuration"
    if [ -f .env ]; then
        print_warning ".env file already exists"
        if [ "$AUTO_MODE" = true ]; then
            print_info "Using existing .env file (auto mode)"
        else
            read -p "Do you want to regenerate it? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                setup_env_file
            else
                print_info "Keeping existing .env file"
            fi
        fi
    else
        setup_env_file
    fi
    
    # Apply SSL settings to .env (whether newly created or existing)
    apply_ssl_settings_to_env
    
    # Automatic port conflict resolution
    auto_resolve_ports
    
    # Check Docker network conflicts
    print_header "Checking Docker Network"
    if docker network inspect isp-manager-network >/dev/null 2>&1; then
        print_warning "ISP Manager network already exists"
        EXISTING_SUBNET=$(docker network inspect isp-manager-network -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}')
        print_info "Existing subnet: $EXISTING_SUBNET"
        
        if [ "$EXISTING_SUBNET" != "172.25.0.0/16" ]; then
            print_warning "Network subnet has changed"
            if [ "$AUTO_MODE" = true ]; then
                print_info "Will recreate network (auto mode)"
                docker network rm isp-manager-network 2>/dev/null || true
            else
                read -p "Recreate network with correct subnet? (y/n) " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    docker network rm isp-manager-network 2>/dev/null || true
                    print_success "Network will be recreated during deployment"
                fi
            fi
        else
            print_success "Network configuration is correct"
        fi
    else
        print_success "Network will be created during deployment"
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
                if [ "$AUTO_MODE" = true ]; then
                    print_info "Skipping npm install in auto mode"
                else
                    read -p "Do you want to install Node.js dependencies for local development? (y/n) " -n 1 -r
                    echo
                    if [[ $REPLY =~ ^[Yy]$ ]]; then
                        npm install
                        print_success "Node.js dependencies installed"
                    fi
                fi
            fi
        fi
    fi
    
    # Final summary
    print_header "Setup Complete!"
    print_success "Your server is ready for ISP Manager deployment"
    echo ""
    
    # Show configuration summary
    print_info "Configuration Summary:"
    echo "  Application Port: $(grep "^APP_HOST_PORT=" .env | cut -d'=' -f2)"
    echo "  PostgreSQL Port:  $(grep "^POSTGRES_HOST_PORT=" .env | cut -d'=' -f2)"
    echo "  RADIUS Auth:      $(grep "^RADIUS_AUTH_PORT=" .env | cut -d'=' -f2)/udp"
    echo "  RADIUS Acct:      $(grep "^RADIUS_ACCT_PORT=" .env | cut -d'=' -f2)/udp"
    echo ""
    
    print_info "Next steps:"
    
    if [ -n "$SSL_DOMAIN" ]; then
        echo "  1. Ensure DNS for ${SSL_DOMAIN} points to this server"
        echo "  2. Run './deploy.sh' to build and start the application"
        echo "  3. Access the application at https://${SSL_DOMAIN}"
    else
        echo "  1. Run './deploy.sh' to build and start the application"
        APP_PORT=$(grep "^APP_HOST_PORT=" .env | cut -d'=' -f2)
        echo "  2. Access the application at http://localhost:${APP_PORT}"
    fi
    
    echo ""
    print_info "Default credentials:"
    echo "  Username: adhielesmana"
    echo "  Password: admin123"
    echo ""
    
    print_success "All port conflicts have been automatically resolved!"
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
    elif command_exists netstat; then
        netstat -tuln | grep -q ":$PORT "
        return $?
    else
        # Cannot check, assume not in use
        return 1
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
}

# Run main function
main "$@"

exit 0
