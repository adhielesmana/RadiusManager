import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Plus, Search, Download, Eye, DollarSign, CreditCard, History } from "lucide-react";
import type { Invoice } from "@shared/schema";
import { InvoiceDialog } from "@/components/invoice-dialog";
import { PaymentDialog } from "@/components/payment-dialog";
import { PaymentHistoryDialog } from "@/components/payment-history-dialog";

export default function Invoices() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice & { customerName: string; profileName?: string } | null>(null);

  const { data: invoices = [], isLoading } = useQuery<(Invoice & { customerName: string; profileName?: string })[]>({
    queryKey: ['/api/invoices'],
  });

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-invoices">Invoices</h1>
          <p className="text-sm text-muted-foreground">Manage billing and payments</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setPaymentDialogOpen(true)} data-testid="button-record-payment">
            <CreditCard className="mr-2 h-4 w-4" /> Record Payment
          </Button>
          <Button onClick={() => setDialogOpen(true)} data-testid="button-generate-invoice">
            <Plus className="mr-2 h-4 w-4" /> Generate Invoice
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoices by number or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-invoices"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-12 text-center">
              <DollarSign className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-base font-medium text-muted-foreground">No invoices found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? "Try adjusting your search" : "Generate your first invoice to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Invoice #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Profile</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border hover-elevate" data-testid={`invoice-row-${invoice.id}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono font-medium">{invoice.invoiceNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{invoice.customerName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">{invoice.profileName || 'N/A'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">${Number(invoice.total).toFixed(2)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} type="payment" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">
                          {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setPaymentHistoryOpen(true);
                            }}
                            data-testid={`button-view-payments-${invoice.id}`}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" data-testid={`button-view-invoice-${invoice.id}`}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" data-testid={`button-download-invoice-${invoice.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <InvoiceDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <PaymentDialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen} />
      <PaymentHistoryDialog 
        open={paymentHistoryOpen} 
        onOpenChange={setPaymentHistoryOpen}
        invoiceId={selectedInvoice?.id}
        invoiceNumber={selectedInvoice?.invoiceNumber}
      />
    </div>
  );
}
