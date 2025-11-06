# ISP Manager - FreeRADIUS Customer Management System

## Overview
ISP Manager is a professional management system designed for Internet Service Providers. It integrates with FreeRADIUS for robust customer authentication and offers comprehensive modules for customer relationship management, service profile configuration, billing, payment tracking, and support ticketing. The system aims to streamline ISP operations, enhance customer service, and provide real-time insights into network performance and revenue.

## User Preferences
I prefer iterative development with clear, modular code. Please ask for clarification if a task is unclear. I value detailed explanations for complex features or architectural decisions. Do not make changes to the `shared/schema.ts` file without explicit instruction.

## System Architecture
The application follows a client-server architecture. The frontend is built with React, TypeScript, Tailwind CSS, and Shadcn UI, emphasizing a professional blue color palette and Inter typography, with JetBrains Mono for technical data. The layout uses sidebar navigation and responsive data tables. Core UI components are standardized, including status indicators for customer, payment, and ticket statuses.

The backend is developed using Node.js with Express.js, leveraging PostgreSQL as the primary database managed by Drizzle ORM. Authentication is handled via FreeRADIUS, which integrates directly with PostgreSQL tables (`radcheck`, `radreply`, `radgroupcheck`, `radgroupreply`, `radusergroup`) for user and group attribute management.

Key business logic revolves around:
- **Customer Management**: Unique by national ID, customers can have multiple subscriptions.
- **Subscription Management**: Links customers to service profiles at specific locations, including optional static IP and MAC binding.
- **Service Profiles**: Define speed, quota, FUP settings, and pricing.
- **Invoicing & Payments**: Subscription-based billing with atomic invoice generation (INVYYMMDDNNNNN format), tax calculation, and automatic payment status updates.
- **Ticketing System**: Manages support requests with priority and status tracking.
- **Activity Logging**: Provides an audit trail for all customer changes.
- **Settings**: Global application settings, including currency selection (default: IDR) and company logo management (stored as base64).
- **Authentication System**: Features user management with role-based access control (Superadmin, Admin, User), session management via HTTP-only cookies, and protected routes. A hardcoded superadmin exists for initial setup.
- **Company Group System**: Allows for multi-company group management, influencing subscription ID generation.

The system is designed for deployment using Docker Compose, orchestrating PostgreSQL, FreeRADIUS, and the ISP Manager application.

## External Dependencies
- **PostgreSQL**: Relational database used for all application and FreeRADIUS data.
- **FreeRADIUS**: Open-source RADIUS server for network access control and authentication.
- **React**: Frontend JavaScript library for building user interfaces.
- **Node.js/Express.js**: Backend JavaScript runtime and web application framework.
- **Drizzle ORM**: TypeScript ORM for interacting with PostgreSQL.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Shadcn UI**: Reusable UI components.
- **TanStack Query (React Query)**: Data fetching and state management for React.
- **Docker Compose**: Tool for defining and running multi-container Docker applications.

## Recent Changes

### 2025-11-06: Docker Deployment Complete
✅ **Complete dockerization with FreeRADIUS integration**
- Multi-stage Dockerfile for ISP Manager application
- Docker Compose orchestrating PostgreSQL, FreeRADIUS, and ISP Manager services
- FreeRADIUS configured with PostgreSQL SQL backend
- Shared database for both ISP Manager and FreeRADIUS
- Auto-initialization of FreeRADIUS tables (radcheck, radreply, radacct, nas, etc.)
- Environment-based configuration with .env file
- Automated deployment scripts (setup.sh and deploy.sh)
- Comprehensive README-DOCKER.md with setup, testing, and troubleshooting guides
- Files created: Dockerfile, docker-compose.yml, .env.example, setup.sh, deploy.sh, docker/freeradius/*, docker/postgres-init/*

**Quick Start (Automated):**
```bash
./setup.sh    # One-time setup
./deploy.sh   # Build and deploy
```

**Quick Start (Manual):**
```bash
cp .env.example .env
docker compose up -d
```

### 2025-11-06: Invoice Number Format Update
✅ **New atomic generation with date-based format**
- Format: INVYYMMDDNNNNN (e.g., INV25110600001 for Nov 6, 2025, sequence #1)
- Atomic SQL generation using CTE to prevent race conditions
- Fixed SUBSTRING bug (now correctly extracts all 5 digits from position 10)
- Daily sequence reset (00001-99999)
- Auto-generated on backend, not user-editable
- E2E Tested: Invoice creation and sequence increment verified

### 2025-11-06: Logo Display in Login & Sidebar
✅ **Dynamic branding with company logo**
- Login page displays company logo when set, falls back to Gauge icon
- "ISP Manager" text hidden when company logo exists
- Sidebar displays logo with proper sizing (h-10, max-w-180px)
- Optimized logo dimensions for professional appearance

### 2025-11-06: Authentication System
✅ **Full user management with role-based access control**
- Database: Created users table with bcrypt password hashing
- Hardcoded Superadmin: adhielesmana/admin123 (cannot be modified or deleted)
- Session Management: Express-session with HTTP-only cookies, 7-day expiry
- Backend: Login/logout/session endpoints with authentication middleware
- Frontend: Auth context, protected routes, login page, role-based UI
- Sidebar: Dynamic menu filtering based on user role (superadmin sees all)
- E2E Tested: Complete authentication flow verified