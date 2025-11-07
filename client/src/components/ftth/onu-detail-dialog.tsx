import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, Signal, RefreshCw, Server, Activity, Calendar, AlertTriangle } from "lucide-react";
import type { Onu } from "@shared/schema";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface OnuDetailDialogProps {
  onu: Onu | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oltName?: string;
  boxName?: string;
}

export function OnuDetailDialog({ onu, open, onOpenChange, oltName, boxName }: OnuDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRawOutput, setShowRawOutput] = useState(false);

  const fetchDetailsMutation = useMutation({
    mutationFn: async (onuId: number) => {
      return await apiRequest("POST", `/api/onus/${onuId}/fetch-details`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onus'] });
      toast({
        title: "Success",
        description: "ONU details fetched and updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!onu) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
      case "working":
      case "ready":
        return "default";
      case "offline":
        return "destructive";
      case "silent":
        return "secondary";
      default:
        return "outline";
    }
  };

  const handleFetchDetails = () => {
    fetchDetailsMutation.mutate(onu.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              <DialogTitle>ONU {onu.ponSerial}</DialogTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFetchDetails}
              disabled={fetchDetailsMutation.isPending}
              data-testid="button-fetch-details"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${fetchDetailsMutation.isPending ? 'animate-spin' : ''}`} />
              Fetch Latest
            </Button>
          </div>
          <DialogDescription>Optical Network Unit Details</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
              <Server className="h-4 w-4" />
              Basic Information
            </h4>
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
              {(onu as any).onuName && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ONU Name</label>
                  <p className="mt-1 text-sm">{(onu as any).onuName}</p>
                </div>
              )}
              {(onu as any).deviceType && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Device Type</label>
                  <p className="mt-1 text-sm">{(onu as any).deviceType}</p>
                </div>
              )}
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
          </div>

          {/* Port & ID Information */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold mb-3">Port & Identification</h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">PON Port</label>
                <p className="mt-1 font-mono">{onu.ponPort}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">ONU ID</label>
                <p className="mt-1 font-mono">{onu.onuId || 'N/A'}</p>
              </div>
              {onu.macAddress && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">MAC Address</label>
                  <p className="mt-1 font-mono text-xs">{onu.macAddress}</p>
                </div>
              )}
            </div>
          </div>

          {/* OLT Status Information */}
          {((onu as any).state || (onu as any).phaseState || (onu as any).adminState || (onu as any).configState) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
                <Activity className="h-4 w-4" />
                OLT Status
              </h4>
              <div className="grid grid-cols-4 gap-4">
                {(onu as any).state && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">State</label>
                    <div className="mt-1">
                      <Badge variant={getStatusColor((onu as any).state)}>
                        {(onu as any).state}
                      </Badge>
                    </div>
                  </div>
                )}
                {(onu as any).phaseState && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Phase State</label>
                    <div className="mt-1">
                      <Badge variant={getStatusColor((onu as any).phaseState)}>
                        {(onu as any).phaseState}
                      </Badge>
                    </div>
                  </div>
                )}
                {(onu as any).adminState && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Admin State</label>
                    <div className="mt-1">
                      <Badge variant="outline">{(onu as any).adminState}</Badge>
                    </div>
                  </div>
                )}
                {(onu as any).configState && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Config State</label>
                    <div className="mt-1">
                      <Badge variant="outline">{(onu as any).configState}</Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Signal & Distance */}
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
                    <p className={`mt-1 font-mono ${parseFloat(String(onu.signalRx)) < -28 ? 'text-destructive' : ''}`}>
                      {onu.signalRx} dBm
                    </p>
                  </div>
                )}
                {onu.signalTx !== null && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">TX Signal</label>
                    <p className={`mt-1 font-mono ${parseFloat(String(onu.signalTx)) < -28 ? 'text-destructive' : ''}`}>
                      {onu.signalTx} dBm
                    </p>
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

          {/* Service Configuration */}
          {((onu as any).vportMode || (onu as any).dbaMode || (onu as any).fec || (onu as any).authenticationMode || onu.vlanId || onu.bandwidthProfile) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3">Service Configuration</h4>
              <div className="grid grid-cols-3 gap-4">
                {(onu as any).vportMode && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Vport Mode</label>
                    <p className="mt-1 text-sm">{(onu as any).vportMode}</p>
                  </div>
                )}
                {(onu as any).dbaMode && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">DBA Mode</label>
                    <p className="mt-1 text-sm">{(onu as any).dbaMode}</p>
                  </div>
                )}
                {(onu as any).fec && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">FEC</label>
                    <p className="mt-1 text-sm">{(onu as any).fec}</p>
                  </div>
                )}
                {(onu as any).authenticationMode && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Auth Mode</label>
                    <p className="mt-1 text-sm">{(onu as any).authenticationMode}</p>
                  </div>
                )}
                {(onu as any).currentChannel && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Channel</label>
                    <p className="mt-1 text-sm">{(onu as any).currentChannel}</p>
                  </div>
                )}
                {(onu as any).snBind && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">SN Bind</label>
                    <p className="mt-1 text-sm">{(onu as any).snBind}</p>
                  </div>
                )}
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
                {(onu as any).lineProfile && (onu as any).lineProfile !== 'N/A' && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Line Profile</label>
                    <p className="mt-1 text-sm">{(onu as any).lineProfile}</p>
                  </div>
                )}
                {(onu as any).serviceProfile && (onu as any).serviceProfile !== 'N/A' && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Service Profile</label>
                    <p className="mt-1 text-sm">{(onu as any).serviceProfile}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event History */}
          {((onu as any).onlineDuration || (onu as any).lastAuthpassTime || (onu as any).lastOfflineTime || (onu as any).lastDownCause) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />
                Event History
              </h4>
              <div className="grid grid-cols-2 gap-4">
                {(onu as any).onlineDuration && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Online Duration</label>
                    <p className="mt-1 text-sm">{(onu as any).onlineDuration}</p>
                  </div>
                )}
                {(onu as any).lastDownCause && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Down Cause</label>
                    <p className="mt-1 text-sm">{(onu as any).lastDownCause}</p>
                  </div>
                )}
                {(onu as any).lastAuthpassTime && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Auth Time</label>
                    <p className="mt-1 text-sm">
                      {format(new Date((onu as any).lastAuthpassTime), "PPP p")}
                    </p>
                  </div>
                )}
                {(onu as any).lastOfflineTime && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Offline Time</label>
                    <p className="mt-1 text-sm">
                      {format(new Date((onu as any).lastOfflineTime), "PPP p")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          {(onu.registrationDate || onu.lastOnline) && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Timestamps
              </h4>
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

          {/* Description */}
          {onu.description && (
            <div className="border-t pt-4">
              <label className="text-sm font-medium text-muted-foreground">Description</label>
              <p className="mt-1 text-sm">{onu.description}</p>
            </div>
          )}

          {/* Raw Output - Collapsible */}
          {(onu as any).detailsRawOutput && (
            <div className="border-t pt-4">
              <Collapsible open={showRawOutput} onOpenChange={setShowRawOutput}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full">
                    {showRawOutput ? 'Hide' : 'Show'} Raw OLT Output
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs font-mono">
                    {(onu as any).detailsRawOutput}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
