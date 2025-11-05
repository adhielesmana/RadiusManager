import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaymentHistory } from "./payment-history";

interface PaymentHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId?: number;
  invoiceNumber?: string;
}

export function PaymentHistoryDialog({ 
  open, 
  onOpenChange, 
  invoiceId, 
  invoiceNumber 
}: PaymentHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-payment-history">
        <DialogHeader>
          <DialogTitle>
            Payment History {invoiceNumber && `- ${invoiceNumber}`}
          </DialogTitle>
        </DialogHeader>
        <PaymentHistory invoiceId={invoiceId} title="" />
      </DialogContent>
    </Dialog>
  );
}
