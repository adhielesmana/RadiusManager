import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, User, Phone } from "lucide-react";
import type { Pop } from "@shared/schema";

interface PopDetailDialogProps {
  pop: Pop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PopDetailDialog({ pop, open, onOpenChange }: PopDetailDialogProps) {
  if (!pop) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {pop.name}
          </DialogTitle>
          <DialogDescription>Point of Presence Details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">POP Code</label>
              <p className="mt-1 font-mono">{pop.code}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge variant={pop.isActive ? "default" : "secondary"}>
                  {pop.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">Address</label>
            <p className="mt-1">{pop.address || "Not specified"}</p>
          </div>

          {(pop.latitude && pop.longitude) && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Latitude</label>
                <p className="mt-1 font-mono">{Number(pop.latitude).toFixed(6)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Longitude</label>
                <p className="mt-1 font-mono">{Number(pop.longitude).toFixed(6)}</p>
              </div>
            </div>
          )}

          {pop.contactPerson && (
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" />
                Contact Person
              </label>
              <p className="mt-1">{pop.contactPerson}</p>
            </div>
          )}

          {pop.contactPhone && (
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Contact Phone
              </label>
              <p className="mt-1">{pop.contactPhone}</p>
            </div>
          )}

          {pop.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="mt-1 text-sm">{pop.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
