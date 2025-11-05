# ISP Management System - Design Guidelines

## Design Approach
**System**: Modern SaaS Dashboard Design - inspired by Linear's clarity, Notion's information hierarchy, and enterprise tools like Splynx. Prioritizing data density, scanning efficiency, and professional aesthetics for ISP operations.

## Core Design Principles
1. **Information Hierarchy**: Clear visual weight for critical data (customer status, payment state, ticket urgency)
2. **Scanning Efficiency**: Dense but readable layouts optimized for quick data processing
3. **Action Clarity**: Prominent CTAs for critical operations (suspend service, create ticket, process payment)

## Typography System

**Font Stack**: 
- Primary: Inter (Google Fonts) - UI elements, tables, forms
- Monospace: JetBrains Mono - technical data (MAC addresses, IPs, RADIUS attributes)

**Hierarchy**:
- Page Titles: text-2xl font-semibold
- Section Headers: text-lg font-semibold
- Card Titles: text-base font-medium
- Body Text: text-sm font-normal
- Table Headers: text-xs font-semibold uppercase tracking-wide
- Data Fields: text-sm font-medium (customer names, amounts)
- Technical Data: text-xs font-mono (MAC addresses, IPs)
- Labels: text-xs font-medium
- Helper Text: text-xs

## Layout System

**Spacing Primitives**: Use Tailwind units of 1, 2, 3, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section gaps: gap-4 to gap-6
- Card spacing: space-y-4
- Form field spacing: space-y-3
- Table cell padding: px-4 py-3

**Container Structure**:
- Full viewport height dashboard layout
- Fixed sidebar: w-64
- Main content area: Remaining width with max-w-7xl mx-auto px-6 py-8
- Cards: Rounded corners (rounded-lg), shadow-sm borders

## Component Library

### Navigation
**Sidebar Navigation** (Fixed Left, Full Height):
- Logo/Brand area at top (h-16)
- Primary navigation items with icons (Heroicons)
- Active state indication with visual emphasis
- Sections: Dashboard, Customers, Profiles, Invoicing, Tickets, Settings
- User profile dropdown at bottom

**Top Bar**:
- Breadcrumb navigation (text-sm)
- Search bar (prominent, expandable)
- Notification bell icon with badge
- User avatar dropdown

### Dashboard Components
**Metric Cards** (Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4):
- Large number display (text-3xl font-bold)
- Metric label (text-sm)
- Trend indicator (icon + percentage)
- Icon in corner (Heroicons)

**Status Overview Cards**:
- Active Customers count
- Revenue This Month
- Pending Tickets
- Expiring Accounts (within 7 days)

**Recent Activity Tables**:
- Recent Invoices (5 rows)
- Open Tickets (5 rows)
- Upcoming Expirations (5 rows)

### Data Tables
**Structure**:
- Striped rows for readability
- Hover state on rows
- Fixed header on scroll
- Sticky action column (right-aligned)
- Sortable column headers with icons
- Pagination controls at bottom (showing X-Y of Z results)

**Customer Table Columns**:
- Status badge | Name/ID | Profile | Phone | Address | Expiry Date | Actions
- Status badges: pill-shaped with distinct visual treatment (Active/Suspended/Expired)
- Row actions: Quick view icon, Edit icon, Menu (three dots) for more options

**Ticket Table Columns**:
- Priority badge | Ticket ID | Customer | Category | Status | Created | Assigned To | Actions

### Forms
**Customer Entry Form** (Two-Column Layout on Desktop):
- Personal Info section
- Contact Details section  
- Service Details section
- Installation Info section
- Each section with clear header (text-lg font-semibold mb-4)

**Form Elements**:
- Labels: text-sm font-medium mb-1
- Input fields: Full width, h-10, px-3, rounded border
- Select dropdowns: Consistent height with inputs
- Textareas: min-h-24
- Required field indicator (*)
- Helper text below fields (text-xs)
- Form actions: Right-aligned, gap-3 (Cancel + Primary CTA)

### Profile Management
**Profile Cards** (Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3):
- Profile name (text-lg font-semibold)
- Speed display (Download/Upload with icons)
- Quota display with progress indicator
- FUP threshold
- Validity period
- Price (prominent, text-xl font-bold)
- Edit/Delete actions
- "Assign to Customer" CTA button

### Invoice Components
**Invoice Card/Modal**:
- Company header area
- Invoice number + date (top right)
- Customer details (left column)
- Billing details (right column)
- Line items table (Service, Period, Price)
- Subtotal, Tax, Total (right-aligned, Total in larger bold text)
- Payment status badge
- Action buttons (Download PDF, Send Email, Mark Paid)

### Ticketing System
**Ticket Creation Form**:
- Customer search/select (autocomplete dropdown)
- Category dropdown (Connection/Speed/Billing/Profile Change/Technical)
- Priority selector (Low/Medium/High/Urgent) with visual indicators
- Subject line (text-base)
- Description (rich textarea, min-h-32)
- Attachment upload area
- Submit button (prominent)

**Ticket Detail View**:
- Header: Ticket ID, Status, Priority, Created date
- Customer info card (left sidebar): Name, phone, WhatsApp, profile details
- Main content: Description, timeline of updates, resolution notes
- Status update dropdown + notes textarea
- Assign technician dropdown
- Action buttons: Update Status, Add Note, Close Ticket

### Modals & Overlays
**Modal Structure**:
- Overlay with backdrop blur
- Centered modal (max-w-2xl for forms, max-w-4xl for data views)
- Header with title + close icon
- Content area with appropriate padding (p-6)
- Footer with actions (right-aligned)

**Quick Actions Menu** (Dropdown from table row actions):
- View Details
- Edit
- Suspend Service
- Reactivate Service  
- Generate Invoice
- Create Ticket
- View Activity Log

### Status Indicators
**Badges** (Pill-shaped, px-2.5 py-0.5 text-xs font-medium rounded-full):
- Customer Status: Active, Suspended, Expired
- Payment Status: Paid, Pending, Overdue
- Ticket Status: Open, In Progress, Resolved, Closed
- Ticket Priority: Low, Medium, High, Urgent

### Empty States
- Icon (centered, large)
- Message (text-base font-medium)
- Description (text-sm)
- CTA button ("Add First Customer", "Create Profile", etc.)

## Images
No hero images needed. This is a functional dashboard application. Use icons throughout from Heroicons library exclusively.

## Professional Touches
- Loading states: Skeleton screens for tables during data fetch
- Toast notifications: Top-right corner for success/error messages
- Confirmation dialogs: For destructive actions (suspend service, delete customer)
- Keyboard shortcuts: Display hints for power users (Cmd+K for search)
- Export functionality: CSV/PDF buttons on data tables
- Bulk actions: Checkbox selection on tables with bulk action bar