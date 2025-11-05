import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { DollarSign, Calendar, CreditCard, FileText } from "lucide-react";
import type { Payment } from "@shared/schema";

interface PaymentHistoryProps {
  invoiceId?: number;
  customerId?: number;
  title?: string;
}

export function PaymentHistory({ invoiceId, customerId, title = "Payment History" }: PaymentHistoryProps) {
  // Build the appropriate query key based on props
  const queryKey = invoiceId 
    ? [`/api/payments/invoice/${invoiceId}`]
    : customerId
    ? [`/api/payments/customer/${customerId}`]
    : ['/api/payments'];

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey,
  });

  const totalPaid = payments.reduce((sum, payment) => {
    const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
    return sum + amount;
  }, 0);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (payments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center">
            <DollarSign className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No payments recorded yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="text-sm font-medium">
            Total Paid: <span className="text-green-600 dark:text-green-400">${totalPaid.toFixed(2)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {payments.map((payment) => {
            const amount = typeof payment.amount === 'string' ? parseFloat(payment.amount) : payment.amount;
            const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : null;

            return (
              <div
                key={payment.id}
                className="p-3 rounded-md border border-border hover-elevate"
                data-testid={`payment-${payment.id}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <span className="font-semibold text-green-600 dark:text-green-400" data-testid={`payment-amount-${payment.id}`}>
                      ${amount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span data-testid={`payment-date-${payment.id}`}>
                      {paymentDate ? format(paymentDate, "MMM dd, yyyy") : 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-3 w-3 text-muted-foreground" />
                    <span className="capitalize" data-testid={`payment-method-${payment.id}`}>
                      {payment.paymentMethod.replace('_', ' ')}
                    </span>
                  </div>

                  {payment.transactionReference && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span className="text-xs" data-testid={`payment-ref-${payment.id}`}>
                        Ref: {payment.transactionReference}
                      </span>
                    </div>
                  )}

                  {payment.notes && (
                    <p className="text-xs text-muted-foreground mt-2 pl-5" data-testid={`payment-notes-${payment.id}`}>
                      {payment.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
