# ISP Manager - FreeRADIUS Customer Management System

## Overview
Professional ISP management system with FreeRADIUS integration for customer authentication, billing, service profiles, and support ticketing.

## Features
- **Dashboard**: Real-time metrics showing total customers, active users, revenue, and pending tickets
- **Customer Management**: Complete CRUD operations with authentication details, contact info, and installation data
- **Service Profiles**: Speed plans with quotas, FUP settings, validity periods, and pricing
- **Invoice Generation**: Professional billing with payment status tracking
- **Payment Tracking**: Full payment history with automatic invoice status updates
- **Ticketing System**: Support ticket management with priority levels and status tracking
- **FreeRADIUS Integration**: Full RADIUS authentication with user and group attributes
- **Activity Logging**: Complete audit trail of customer changes
- **Status Management**: Automatic customer status updates (Active/Suspended/Expired)
- **Currency Selection**: Worldwide currency support (48+ currencies) with Indonesian Rupiah (Rp) as default

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
- **settings**: Application settings including currency preference (default: IDR)

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
- `POST /api/subscriptions` - Create subscription (auto-generates subscription ID)
- `PATCH /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/company-groups` - List all company groups
- `GET /api/company-groups/:id` - Get company group by ID
- `POST /api/company-groups` - Create company group
- `PATCH /api/company-groups/:id` - Update company group
- `GET /api/profiles` - List service profiles
- `POST /api/profiles` - Create profile
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Generate invoice (requires subscriptionId)
- `GET /api/tickets` - List tickets
- `POST /api/tickets` - Create ticket
- `GET /api/settings` - Get application settings (currency)
- `PATCH /api/settings` - Update application settings

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
- 2025-11-06: **AUTHENTICATION SYSTEM COMPLETE** - Full user management with role-based access control
  - ✅ Database: Created users table with bcrypt password hashing
  - ✅ Hardcoded Superadmin: adhielesmana/admin123 (cannot be modified or deleted)
  - ✅ Session Management: Express-session with HTTP-only cookies, 7-day expiry
  - ✅ Backend: Login/logout/session endpoints with authentication middleware
  - ✅ Frontend: Login page, authentication context, protected routes
  - ✅ User Management: Full CRUD for users (add/edit/delete, superadmin only)
  - ✅ Role-Based Access: Sidebar filters menus based on user role (superadmin/admin/user)
  - ✅ E2E Tested: All authentication flows validated - login, user creation, logout, role permissions
  - 📝 Production TODO: Set SESSION_SECRET env var and use Redis for session store
- 2025-11-06: **DASHBOARD METRICS UPDATE** - Network performance monitoring
  - ✅ Updated dashboard to show 4 key metrics: Total Customers, Total Subscriptions, Active Tickets, Network Performance
  - ✅ Network Performance calculated as: 100% - (active tickets / total customers × 100%)
  - ✅ Active tickets include both 'open' and 'in_progress' status tickets
  - ✅ Performance metric clamped between 0-100% and displayed with 2 decimal places
  - 📝 Example: 6 customers, 1 active ticket = 83.33% network performance
- 2025-11-06: **MULTI-COMPANY GROUP SYSTEM COMPLETE** - Full subscription ID management with atomic generation
  - ✅ Database: Created company_groups table and updated subscriptions with subscriptionId + companyGroupId
  - ✅ Atomic ID Generation: Subscription IDs (YYMMDDXNNNN) generated atomically using CTE to prevent race conditions
  - ✅ Backend: Company groups CRUD operations and DELETE subscription endpoint
  - ✅ Frontend: Subscription dialog with company group selection and updated status values
  - ✅ Subscriptions Page: Complete table view with subscription IDs, customer info, profile, and status
  - ✅ Settings: Company groups management section with add/edit functionality
  - ✅ Navigation: Added Subscriptions link to sidebar
  - 📝 Note: Subscription ID generation uses atomic SQL with CTE to ensure uniqueness under concurrent writes
- 2025-11-06: **LOGO FILE UPLOAD FEATURE COMPLETE** - Direct file upload for company branding
  - ✅ Database: Changed logoUrl from varchar(500) to text to support base64-encoded images
  - ✅ Settings Page: File upload interface with drag-and-drop area (replaced URL input)
  - ✅ Base64 Conversion: Converts uploaded images to data URLs for database storage
  - ✅ File Validation: Type checking (images only) and size limit (2MB max)
  - ✅ Auto-Save: Automatically saves logo after upload, no separate save button needed
  - ✅ Remove/Change: Remove logo button and change logo functionality
  - ✅ AppSidebar: Displays uploaded logo in sidebar header
  - ✅ InvoiceDetailDialog: Shows logo on professional invoice view
  - 📝 Note: Solves hotlink issues - logos stored directly in database as base64
- 2025-11-05: **LOGO UPLOAD/URL FEATURE** - Company branding with logo support implemented
  - ✅ Database: Added logoUrl field to settings table
  - ✅ Settings Page: Logo URL input with live preview functionality
  - ✅ AppSidebar: Dynamic logo display (shows logo image when set, falls back to Gauge icon)
  - ✅ InvoiceDetailDialog: Professional invoice view with company logo for printing/PDF
  - ✅ Invoices Page: View/Download buttons open invoice detail dialog
  - 📝 Note: Changed to file upload in next update due to hotlink issues
- 2025-11-05: **CURRENCY SELECTION FEATURE COMPLETE** - Worldwide currency support implemented
  - ✅ Database: Added settings table with currencyCode field (default: IDR - Indonesian Rupiah)
  - ✅ Backend: GET/PATCH /api/settings endpoints for currency management
  - ✅ Frontend: useCurrency() hook provides currency object and formatCurrency() function
  - ✅ UI Updates: All money displays (dashboard, profiles, invoices) use dynamic currency formatting
  - ✅ Type Safety: Decimal field handling in storage layer (string conversions for price/amount/tax/total)
  - ✅ Currency List: 48+ worldwide currencies including IDR, USD, EUR, GBP, JPY, AUD, etc.
  - ✅ E2E Testing: All 21 test steps passed - currency changes apply globally across the app
  - 📝 Note: Console warning about "Maximum update depth exceeded" in InvoiceDialog - non-blocking
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
