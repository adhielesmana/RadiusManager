# ISP Manager - FreeRADIUS Customer Management System

## Overview
Professional ISP management system with FreeRADIUS integration for customer authentication, billing, service profiles, and support ticketing.

## Features
- **Dashboard**: Real-time metrics showing total customers, active users, revenue, and pending tickets
- **Customer Management**: Complete CRUD operations with authentication details, contact info, and installation data
- **Service Profiles**: Speed plans with quotas, FUP settings, validity periods, and pricing
- **Invoice Generation**: Professional billing with payment status tracking
- **Ticketing System**: Support ticket management with priority levels and status tracking
- **FreeRADIUS Integration**: Full RADIUS authentication with user and group attributes
- **Activity Logging**: Complete audit trail of customer changes
- **Status Management**: Automatic customer status updates (Active/Suspended/Expired)

## Technology Stack
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: FreeRADIUS integration (radcheck, radreply, radgroupcheck, radgroupreply)
- **State Management**: TanStack Query (React Query)

## Project Structure
```
├── client/                  # Frontend React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   │   ├── app-sidebar.tsx
│   │   │   ├── customer-dialog.tsx
│   │   │   ├── profile-dialog.tsx
│   │   │   ├── ticket-dialog.tsx
│   │   │   ├── status-badge.tsx
│   │   │   └── metric-card.tsx
│   │   ├── pages/          # Page components
│   │   │   ├── dashboard.tsx
│   │   │   ├── customers.tsx
│   │   │   ├── profiles.tsx
│   │   │   ├── invoices.tsx
│   │   │   ├── tickets.tsx
│   │   │   └── settings.tsx
│   │   └── App.tsx         # Main app with routing
├── server/                 # Backend Express server
│   ├── db.ts              # Database connection
│   ├── storage.ts         # Data access layer
│   └── routes.ts          # API endpoints
├── shared/                # Shared types and schemas
│   └── schema.ts          # Drizzle schemas and types
└── design_guidelines.md   # UI/UX design specifications

## Database Schema

### Core Business Logic
**One customer (unique by national ID) can have multiple subscriptions at different locations.**

### Core Tables
- **customers**: Customer information (unique by nationalId). No direct link to profiles - customers have subscriptions instead
- **subscriptions**: Links customers to service profiles at specific locations. Includes optional static IP assignment and MAC address binding
- **profiles**: Service plans with speed, quota, FUP, and pricing
- **invoices**: Billing records linked to specific subscriptions (not just customers)
- **payments**: Payment records against invoices with automatic status updates
- **tickets**: Support tickets with priority and status tracking
- **activityLogs**: Audit trail of all customer changes

### Key Relationships
- `customers` → (one-to-many) → `subscriptions`
- `subscriptions` → (many-to-one) → `profiles`
- `subscriptions` → (one-to-many) → `invoices`
- `customers` → (one-to-many) → `invoices`

### FreeRADIUS Tables
- **radcheck**: User authentication attributes (username/password)
- **radreply**: User-specific RADIUS reply attributes (static IP if specified in subscription)
- **radgroupcheck**: Group authentication attributes
- **radgroupreply**: Group reply attributes (speed limits, quotas from profiles)
- **radusergroup**: User to group mapping

## API Endpoints
- `GET /api/dashboard/stats` - Dashboard metrics
- `GET /api/customers` - List all customers
- `POST /api/customers` - Create customer (identity only, no subscription fields)
- `PATCH /api/customers/:id` - Update customer
- `GET /api/subscriptions` - List all subscriptions
- `GET /api/subscriptions/customer/:customerId` - Get customer's subscriptions
- `GET /api/subscriptions/expiring` - Get subscriptions expiring within 7 days
- `POST /api/subscriptions` - Create subscription (auto-calculates expiry)
- `PATCH /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/profiles` - List service profiles
- `POST /api/profiles` - Create profile
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Generate invoice (requires subscriptionId)
- `GET /api/tickets` - List tickets
- `POST /api/tickets` - Create ticket

## Development

### Setup
```bash
npm install
npm run db:push
npm run dev
```

### Database Migrations
```bash
npm run db:push
```

## Design System
- Color Scheme: Professional blue palette with semantic status colors
- Typography: Inter for UI, JetBrains Mono for technical data
- Components: Shadcn UI with custom ISP-specific components
- Layout: Sidebar navigation with responsive data tables

## Status Indicators
- **Customer Status**: Active (green), Suspended (orange), Expired (red)
- **Payment Status**: Paid (green), Pending (yellow), Overdue (red)
- **Ticket Status**: Open (blue), In Progress (purple), Resolved (green), Closed (gray)
- **Ticket Priority**: Urgent (red), High (orange), Medium (yellow), Low (gray)

## Recent Changes
- 2025-11-05: **SUBSCRIPTION ARCHITECTURE COMPLETE** - Full subscription-based system implemented
  - ✅ Backend: Subscription CRUD with RADIUS sync, getExpiringSubscriptions, subscription-specific queries
  - ✅ Frontend: subscription-dialog.tsx, customer-details-dialog.tsx, updated invoice-dialog.tsx
  - ✅ RADIUS Integration: syncCustomerCredentials (radcheck), syncSubscriptionToRadius (radreply/radusergroup)
  - ✅ Cache Management: Fixed query key alignment (['/api/subscriptions/customer', customerId])
  - ✅ Expiry Logic: Auto-calculate only for new subscriptions, preserve on edits
  - ✅ Invoice Generation: Subscription-based billing with customer → subscription → profile flow
  - ✅ Dashboard: Shows expiring subscriptions (not customers), subscription counts per customer
- 2025-11-05: Created subscriptions table (customers → subscriptions → profiles)
  - customers.nationalId unique constraint (one national ID per customer)
  - installation_address, mac_address, activation_date, expiry_date moved to subscriptions
  - Optional static IP assignment (empty = router auto-assigns, filled = RADIUS uses specified IP)
- 2025-11-05: Completed payment tracking system with auto-status updates
- 2025-11-05: Completed invoice generation with auto-numbering and tax calculation
