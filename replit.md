# ISP Manager - FreeRADIUS Customer Management System

## Overview
ISP Manager is a professional management system for Internet Service Providers, integrating with FreeRADIUS for customer authentication. It offers comprehensive modules for CRM, service profile configuration, billing, payment tracking, and support. The system aims to streamline operations, enhance customer service, and provide real-time insights for network performance and revenue. It features a robust multi-company group system and detailed management for FTTH infrastructure, including POPs, OLTs, Distribution Boxes, and ONUs, complete with coverage visualization.

## User Preferences
I prefer iterative development with clear, modular code. Please ask for clarification if a task is unclear. I value detailed explanations for complex features or architectural decisions. Do not make changes to the `shared/schema.ts` file without explicit instruction.

## System Architecture
The application employs a client-server architecture. The frontend uses React, TypeScript, Tailwind CSS, and Shadcn UI, adhering to a professional blue color palette and Inter typography, with JetBrains Mono for technical data. UI/UX emphasizes a sidebar navigation and responsive data tables, with standardized components and status indicators.

The backend is built with Node.js and Express.js, using PostgreSQL as the primary database managed by Drizzle ORM. FreeRADIUS handles authentication, integrating directly with PostgreSQL tables (`radcheck`, `radreply`, `radgroupcheck`, `radgroupreply`, `radusergroup`) for attribute management.

Key features and design decisions include:
- **Customer Management**: Unique by national ID, supporting multiple subscriptions per customer.
- **Subscription Management**: Links customers to service profiles, locations, static IPs, and MAC binding.
- **Service Profiles**: Defines speed, quota, Fair Usage Policy (FUP) settings, and pricing.
- **Invoicing & Payments**: Subscription-based billing with atomic invoice generation (INVYYMMDDNNNNN format), tax calculation, and automatic payment status updates.
- **Ticketing System**: Manages support requests with priority and status tracking.
- **Activity Logging**: Provides an audit trail for all customer-related changes.
- **Settings**: Global application settings, including currency (default: IDR) and company logo management (stored as base64).
- **Authentication System**: Features user management with role-based access control (Superadmin, Admin, User), HTTP-only cookie-based session management, and protected routes. A hardcoded superadmin exists for initial setup. Sessions are PostgreSQL-backed for persistence.
- **Company Group System**: Facilitates multi-company group management, impacting subscription ID generation.
- **FTTH Infrastructure Management**: Hierarchical system for POPs, OLTs, PON Ports, Distribution Boxes, and ONUs, including GPS tracking, capacity planning, and vendor-specific OLT configurations (ZTE C320 GPON, HIOSO EPON). Includes an interactive Leaflet map for coverage visualization. All FTTH management pages feature both read-only detail view and edit capabilities, with dedicated detail dialogs showing comprehensive information about each infrastructure component.
- **Router/NAS Management**: CRUD operations for Network Access Servers (routers) with secure RADIUS secret management and type validation (MikroTik, Cisco, Ubiquiti, Other).
- **FreeRADIUS Integration**: RADIUS server configuration is **database-stored**, not .env-based. By default, when all RADIUS fields in the database are null, the system uses **hardcoded local container defaults** (host='freeradius', secret='testing123', authPort=1812, acctPort=1813). Administrators can configure an **external FreeRADIUS server** via the Settings page UI with **all-or-nothing validation** (all four fields required together: host, secret, auth port, accounting port). Configuration includes comprehensive validation: trimming, integer enforcement for ports, range validation (1-65535), and reset-to-defaults functionality. This database-first approach allows runtime configuration changes without container restarts and supports ISPs with existing RADIUS infrastructure or centralized servers.
- **Deployment**: Supports **dual-mode deployment architecture** with **intelligent nginx auto-detection**:
  
  ### **Intelligent Nginx Detection**
  - **Auto-detects nginx installations**: Host (non-Docker) or Docker containers
  - **Host nginx detected** → Automatically configures Host Nginx mode, adjusts ports to avoid conflicts
  - **Docker nginx detected** → Distinguishes update vs fresh install, offers appropriate options
  - **No nginx detected** → Presents choice between Host or Docker nginx deployment
  - **Zero manual intervention**: Port conflicts automatically resolved
  - **No sudo commands**: All privilege requirements handled via clear error messages
  
  ### **Mode 1: Host Nginx (Multi-App Servers)** - Recommended
  - Nginx installed on host OS (not Docker) via `install-host-nginx.sh`
  - Multiple applications share one nginx instance
  - Each app runs in Docker on unique port (5000, 5001, 5002...)
  - Host nginx proxies to `localhost:PORT` for each app
  - All SSL certificates managed on host at `/etc/letsencrypt/` via certbot
  - Site configs in `/etc/nginx/sites-available/` and `/etc/nginx/sites-enabled/`
  - Clean separation, professional architecture
  - **Best for**: Production servers running multiple services
  
  ### **Mode 2: Docker Nginx (Single-App Deployment)**
  - Self-contained docker-compose with dedicated nginx service
  - Everything isolated in Docker containers
  - Nginx container handles SSL and reverse proxy
  - SSL certificates in Docker volumes
  - No interaction with host or other services
  - **Best for**: Dedicated ISP Manager servers, testing/dev environments
  
  ### **Deployment Features** (Both Modes):
  - **Enhanced setup.sh Script**: Production-grade automated setup with:
    - **Nginx + SSL Management**: Intelligent nginx site configuration with hardened HTTPS
    - **Security Headers**: HSTS, X-Frame-Options, X-Content-Type-Options, XSS-Protection, Referrer-Policy
    - **TLS Best Practices**: TLS 1.2/1.3 only, modern cipher suites, OCSP stapling
    - **Smart Port Detection**: Scans 5000-5100 range with conflict matrix logging
    - **Idempotent Configuration**: Automatically creates/updates .env keys
    - **SSL Fail-Fast Logic**: HTTP-only → SSL attempt → hardened HTTPS on success, clear error handling on failure
    - **ENABLE_SSL Flag Management**: Only true when domain+email provided AND SSL succeeds
  - **Automatic Nginx Detection**: `detect-nginx.sh` identifies existing nginx installations
  - **Automatic Port Adjustment**: `adjust-app-port.sh` resolves port conflicts (5000-5100 range)
  - **Zero-Configuration Setup**: Run `./setup.sh --domain your.domain.com --email your@email.com` for complete automated setup
  - **Automatic SSL Provisioning**: Let's Encrypt certificates via certbot with dry-run verification
  - **Update Detection**: Distinguishes fresh installs from updates to preserve configurations
  - **Health Checks**: Automatic container restart on failure
  - **Production-Ready**: Runs in production mode (Node.js 20, npm start)
  - **Privilege-aware**: Root checks with clear messaging, no inline sudo commands
  - **Database Migration**: Production deployments use raw SQL table creation (bypassing Drizzle's interactive prompts) via `create-missing-tables.sql` for reliable unattended deployment.
    - **Current Approach** (v1 - Production Ready): Raw SQL with `IF NOT EXISTS` statements creates all 26+ tables idempotently. Solves Drizzle's interactive prompt freezing during deployment.
    - **Limitations**: Only handles fresh installations and missing tables. Future schema changes (new columns, indexes, constraints) require manual SQL updates or a versioned migration system.
    - **Future Improvement Path**: Implement sequential versioned migrations (e.g., `migrations/0001_*.sql`, `0002_*.sql`) with a tracking table to support incremental schema updates during application upgrades while maintaining idempotent deployment.

## External Dependencies
- **PostgreSQL**: Relational database for application and FreeRADIUS data.
- **FreeRADIUS**: Open-source RADIUS server for network access control.
- **React**: Frontend library for user interfaces.
- **Node.js/Express.js**: Backend runtime and web framework.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **Tailwind CSS**: Utility-first CSS framework.
- **Shadcn UI**: Reusable UI components.
- **TanStack Query (React Query)**: Data fetching and state management.
- **Docker Compose**: Tool for multi-container Docker applications.
- **react-leaflet/leaflet**: For interactive map visualizations in FTTH coverage.
- **connect-pg-simple**: PostgreSQL session store for Express.js.