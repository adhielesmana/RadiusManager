import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Box, MapPin } from "lucide-react";
import type { DistributionBox } from "@shared/schema";

interface DistributionBoxDetailDialogProps {
  box: DistributionBox | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oltName?: string;
}

export function DistributionBoxDetailDialog({ box, open, onOpenChange, oltName }: DistributionBoxDetailDialogProps) {
  if (!box) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5" />
            {box.name}
          </DialogTitle>
          <DialogDescription>Distribution Box (ODP) Details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Box Code</label>
              <p className="mt-1 font-mono">{box.code}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge variant={box.status === 'active' ? "default" : "secondary"}>
                  {box.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          {oltName && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">OLT</label>
              <p className="mt-1">{oltName}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">PON Port</label>
              <p className="mt-1 font-mono">{box.ponPort}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">PON Slot Index</label>
              <p className="mt-1 font-mono">{box.ponSlotIndex}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Address</label>
            <p className="mt-1">{box.address || "Not specified"}</p>
          </div>

          {(box.latitude && box.longitude) && (
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                GPS Coordinates
              </label>
              <p className="mt-1 font-mono text-sm">
                {Number(box.latitude).toFixed(6)}, {Number(box.longitude).toFixed(6)}
              </p>
            </div>
          )}

          {box.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="mt-1 text-sm">{box.description}</p>
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-2">Capacity Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Max ONUs</label>
                <p className="mt-1 font-mono">{box.maxOnus}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">PON Slot</label>
                <p className="mt-1 text-sm">
                  Slot {box.ponSlotIndex} of 8 (0-7)
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
