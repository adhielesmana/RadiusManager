import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Wifi, Signal } from "lucide-react";
import type { Onu } from "@shared/schema";
import { format } from "date-fns";

interface OnuDetailDialogProps {
  onu: Onu | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oltName?: string;
  boxName?: string;
}

export function OnuDetailDialog({ onu, open, onOpenChange, oltName, boxName }: OnuDetailDialogProps) {
  if (!onu) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "default";
      case "offline":
        return "destructive";
      case "silent":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            ONU {onu.ponSerial}
          </DialogTitle>
          <DialogDescription>Optical Network Unit Details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">PON Serial Number</label>
              <p className="mt-1 font-mono">{onu.ponSerial}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge variant={getStatusColor(onu.status)}>
                  {onu.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {oltName && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">OLT</label>
                <p className="mt-1">{oltName}</p>
              </div>
            )}
            {boxName && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Distribution Box</label>
                <p className="mt-1">{boxName}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">PON Port</label>
              <p className="mt-1 font-mono">{onu.ponPort}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">ONU ID</label>
              <p className="mt-1 font-mono">{onu.onuId}</p>
            </div>
            {onu.macAddress && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">MAC Address</label>
                <p className="mt-1 font-mono text-xs">{onu.macAddress}</p>
              </div>
            )}
          </div>

          {(onu.signalRx !== null || onu.signalTx !== null || onu.distance !== null) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
                <Signal className="h-4 w-4" />
                Signal & Distance
              </h4>
              <div className="grid grid-cols-3 gap-4">
                {onu.signalRx !== null && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">RX Signal</label>
                    <p className="mt-1 font-mono">{onu.signalRx} dBm</p>
                  </div>
                )}
                {onu.signalTx !== null && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">TX Signal</label>
                    <p className="mt-1 font-mono">{onu.signalTx} dBm</p>
                  </div>
                )}
                {onu.distance !== null && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Distance</label>
                    <p className="mt-1 font-mono">{onu.distance} m</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(onu.vlanId || onu.bandwidthProfile) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Service Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                {onu.vlanId && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">VLAN ID</label>
                    <p className="mt-1 font-mono">{onu.vlanId}</p>
                  </div>
                )}
                {onu.bandwidthProfile && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Bandwidth Profile</label>
                    <p className="mt-1">{onu.bandwidthProfile}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(onu.registrationDate || onu.lastOnline) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Dates</h4>
              <div className="grid grid-cols-2 gap-4">
                {onu.registrationDate && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Registration Date</label>
                    <p className="mt-1 text-sm">
                      {format(new Date(onu.registrationDate), "PPP")}
                    </p>
                  </div>
                )}
                {onu.lastOnline && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Online</label>
                    <p className="mt-1 text-sm">
                      {format(new Date(onu.lastOnline), "PPP p")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {onu.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="mt-1 text-sm">{onu.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
