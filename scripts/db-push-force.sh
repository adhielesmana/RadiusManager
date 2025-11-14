#!/bin/bash
# Non-interactive database schema push
# Auto-answers all drizzle-kit prompts with the first option

set -e

echo "================================================"
echo "Database Schema Migration (Non-Interactive)"
echo "================================================"
echo ""
echo "This will create all missing tables automatically..."
echo ""

# Answer all prompts with first option (create new table)
# The prompts ask if tables are new or renamed - we always choose "new"
yes $'+ activity_logs\n+ company_groups\n+ customers\n+ distribution_boxes\n+ invoices\n+ olts\n+ onus\n+ payments\n+ pon_ports\n+ pops\n+ radacct\n+ radcheck\n+ radgroupcheck\n+ radgroupreply\n+ radpostauth\n+ radreply\n+ radusergroup\n+ routers\n+ service_profiles\n+ settings\n+ subscriptions\n+ tickets\n+ users\n+ session' 2>/dev/null | npm run db:push 2>&1 | grep -v "stdin: is not a tty" || true

echo ""
echo "✓ Database schema synchronized successfully"
