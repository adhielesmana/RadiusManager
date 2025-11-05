import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Users, DollarSign, Ticket, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { Customer, Invoice, Ticket as TicketType } from "@shared/schema";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalCustomers: number;
    activeCustomers: number;
    revenue: number;
    pendingTickets: number;
    expiringAccounts: number;
  }>({
    queryKey: ['/api/dashboard/stats'],
  });

  const { data: recentInvoices = [] } = useQuery<(Invoice & { customerName: string })[]>({
    queryKey: ['/api/invoices/recent'],
  });

  const { data: openTickets = [] } = useQuery<(TicketType & { customerName: string })[]>({
    queryKey: ['/api/tickets/open'],
  });

  const { data: expiringCustomers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers/expiring'],
  });

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your ISP operations</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-dashboard">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your ISP operations</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Customers"
          value={stats?.totalCustomers || 0}
          icon={Users}
          testId="metric-total-customers"
        />
        <MetricCard
          title="Active Customers"
          value={stats?.activeCustomers || 0}
          icon={Users}
          testId="metric-active-customers"
        />
        <MetricCard
          title="Revenue This Month"
          value={`$${stats?.revenue?.toFixed(2) || '0.00'}`}
          icon={DollarSign}
          testId="metric-revenue"
        />
        <MetricCard
          title="Pending Tickets"
          value={stats?.pendingTickets || 0}
          icon={Ticket}
          testId="metric-pending-tickets"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-medium">Recent Invoices</CardTitle>
            <Link href="/invoices">
              <Button variant="ghost" size="sm" data-testid="button-view-all-invoices">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent invoices</p>
            ) : (
              recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0" data-testid={`invoice-${invoice.id}`}>
                  <div>
                    <p className="text-sm font-medium">{invoice.customerName}</p>
                    <p className="text-xs text-muted-foreground">{invoice.invoiceNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">${Number(invoice.total).toFixed(2)}</p>
                    <StatusBadge status={invoice.status} type="payment" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-medium">Open Tickets</CardTitle>
            <Link href="/tickets">
              <Button variant="ghost" size="sm" data-testid="button-view-all-tickets">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {openTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No open tickets</p>
            ) : (
              openTickets.map((ticket) => (
                <div key={ticket.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0" data-testid={`ticket-${ticket.id}`}>
                  <div>
                    <p className="text-sm font-medium">{ticket.customerName}</p>
                    <p className="text-xs text-muted-foreground">{ticket.subject}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <StatusBadge status={ticket.priority} type="priority" />
                    <StatusBadge status={ticket.status} type="ticket" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Expiring Soon
            </CardTitle>
            <Link href="/customers">
              <Button variant="ghost" size="sm" data-testid="button-view-all-customers">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {expiringCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No expiring accounts</p>
            ) : (
              expiringCustomers.map((customer) => (
                <div key={customer.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0" data-testid={`expiring-customer-${customer.id}`}>
                  <div>
                    <p className="text-sm font-medium">{customer.fullName}</p>
                    <p className="text-xs text-muted-foreground">{customer.username}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {customer.expiryDate ? new Date(customer.expiryDate).toLocaleDateString() : 'N/A'}
                    </p>
                    <StatusBadge status={customer.status} type="customer" />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
