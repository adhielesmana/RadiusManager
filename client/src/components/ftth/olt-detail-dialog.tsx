import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Radio, Network } from "lucide-react";
import type { Olt } from "@shared/schema";

interface OltDetailDialogProps {
  olt: Olt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  popName?: string;
}

export function OltDetailDialog({ olt, open, onOpenChange, popName }: OltDetailDialogProps) {
  if (!olt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            {olt.name}
          </DialogTitle>
          <DialogDescription>Optical Line Terminal Details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Vendor</label>
              <div className="mt-1">
                <Badge variant="secondary">{olt.vendor}</Badge>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <div className="mt-1">
                <Badge variant={olt.isActive ? "default" : "secondary"}>
                  {olt.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          {popName && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Point of Presence</label>
              <p className="mt-1">{popName}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Network className="h-3 w-3" />
                IP Address
              </label>
              <p className="mt-1 font-mono">{olt.ipAddress}</p>
            </div>
            {olt.model && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Model</label>
                <p className="mt-1">{olt.model}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Total PON Slots</label>
              <p className="mt-1 font-mono">{olt.totalPonSlots}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Ports per Slot</label>
              <p className="mt-1 font-mono">{olt.portsPerSlot}</p>
            </div>
          </div>

          {(olt.telnetPort || olt.telnetUsername) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Telnet Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                {olt.telnetPort && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Port</label>
                    <p className="mt-1 font-mono">{olt.telnetPort}</p>
                  </div>
                )}
                {olt.telnetUsername && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Username</label>
                    <p className="mt-1 font-mono">{olt.telnetUsername}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(olt.snmpPort || olt.snmpCommunity) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">SNMP Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                {olt.snmpPort && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Port</label>
                    <p className="mt-1 font-mono">{olt.snmpPort}</p>
                  </div>
                )}
                {olt.snmpCommunity && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Community String</label>
                    <p className="mt-1 font-mono">{olt.snmpCommunity}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {olt.description && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="mt-1 text-sm">{olt.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
