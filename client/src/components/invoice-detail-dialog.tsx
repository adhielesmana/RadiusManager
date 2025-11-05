import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { Printer, Download, Gauge } from "lucide-react";
import type { Invoice, Customer, Subscription, Profile, Settings } from "@shared/schema";
import { useCurrency } from "@/hooks/use-currency";

interface InvoiceDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice & { customerName?: string; profileName?: string };
}

export function InvoiceDetailDialog({ open, onOpenChange, invoice }: InvoiceDetailDialogProps) {
  const { format: formatCurrency } = useCurrency();
  
  const { data: customer } = useQuery<Customer>({
    queryKey: ['/api/customers', invoice.customerId],
    enabled: open && !!invoice.customerId,
  });

  const { data: subscription } = useQuery<Subscription>({
    queryKey: ['/api/subscriptions', invoice.subscriptionId],
    enabled: open && !!invoice.subscriptionId,
  });

  const { data: settings } = useQuery<Settings>({
    queryKey: ['/api/settings'],
    enabled: open,
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-full" data-testid="dialog-invoice-detail">
        <DialogHeader className="print:hidden">
          <DialogTitle>Invoice Details</DialogTitle>
        </DialogHeader>

        <div className="bg-background p-8 print:p-0" id="invoice-content">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              {settings?.logoUrl ? (
                <img 
                  src={settings.logoUrl} 
                  alt="Company logo" 
                  className="h-16 w-16 object-contain"
                  data-testid="img-invoice-logo"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary">
                  <Gauge className="h-10 w-10 text-primary-foreground" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold">ISP Manager</h2>
                <p className="text-sm text-muted-foreground">Network Control</p>
              </div>
            </div>
            
            <div className="text-right">
              <h1 className="text-3xl font-bold text-primary">INVOICE</h1>
              <p className="text-sm text-muted-foreground mt-1">{invoice.invoiceNumber}</p>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-2">Bill To</h3>
              <div className="space-y-1">
                <p className="font-semibold">{customer?.fullName || invoice.customerName}</p>
                <p className="text-sm text-muted-foreground">{customer?.email}</p>
                <p className="text-sm text-muted-foreground">{customer?.whatsapp}</p>
                {subscription?.installationAddress && (
                  <p className="text-sm text-muted-foreground">{subscription.installationAddress}</p>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Invoice Date: </span>
                  <span className="font-medium">{new Date(invoice.createdAt!).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Due Date: </span>
                  <span className="font-medium">
                    {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Status: </span>
                  <span className={`font-medium ${
                    invoice.status === 'paid' ? 'text-green-600' : 
                    invoice.status === 'partial' ? 'text-yellow-600' : 
                    'text-red-600'
                  }`}>
                    {invoice.status.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-md overflow-hidden mb-8">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold">Description</th>
                  <th className="text-right p-4 text-sm font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="p-4">
                    <p className="font-medium">{invoice.profileName || 'Service Plan'}</p>
                    {invoice.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{invoice.notes}</p>
                    )}
                  </td>
                  <td className="p-4 text-right font-medium">{formatCurrency(invoice.amount)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{formatCurrency(invoice.amount)}</span>
              </div>
              {invoice.tax && parseFloat(String(invoice.tax)) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax:</span>
                  <span className="font-medium">{formatCurrency(invoice.tax)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-lg">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-primary">{formatCurrency(invoice.total)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              Thank you for your business. Please make payment by the due date.
            </p>
          </div>
        </div>

        <div className="flex gap-2 print:hidden">
          <Button onClick={handlePrint} variant="default" data-testid="button-print-invoice">
            <Printer className="h-4 w-4 mr-2" />
            Print Invoice
          </Button>
          <Button onClick={handlePrint} variant="outline" data-testid="button-download-invoice">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
