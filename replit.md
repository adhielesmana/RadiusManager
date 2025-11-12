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
- **Deployment**: Designed for Docker Compose orchestration of PostgreSQL, FreeRADIUS, and the ISP Manager application. Supports flexible Nginx integration with **zero-configuration multi-app deployment**:
  - **Automatic Network Connection**: Auto-detects existing nginx containers and connects isp-manager-app to shared networks
  - **SSL Certificate Management**: Automatically copies certificates from host into nginx container
  - **Nginx Config Patching**: Intelligently fixes nginx.conf to comment out global SSL directives while preserving per-domain certificates
  - **Multi-App SSL Provisioning**: Generates and installs SSL certificates for multiple domains via Let's Encrypt
  - **Smart Detection**: Identifies nginx containers by public port exposure (80/443) and validates connectivity
  - **Graceful Degradation**: Safely handles missing certificates, config errors, and network issues with automatic rollback
  - **Production-Ready**: Runs in production mode (Node.js 20, npm start) with health checks and automatic restarts

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