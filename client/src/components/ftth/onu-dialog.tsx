import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertOnuSchema, type InsertOnu, type Onu, type DistributionBox, type Olt } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OnuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onu: Onu | null;
}

export function OnuDialog({ open, onOpenChange, onu }: OnuDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!onu;

  const { data: distributionBoxes } = useQuery<DistributionBox[]>({
    queryKey: ['/api/distribution-boxes'],
  });

  const { data: olts } = useQuery<Olt[]>({
    queryKey: ['/api/olts'],
  });

  const form = useForm<InsertOnu>({
    resolver: zodResolver(insertOnuSchema),
    defaultValues: {
      ponSerial: "",
      oltId: undefined,
      distributionBoxId: undefined,
      ponPort: "",
      onuId: undefined,
      macAddress: "",
      status: "offline",
      signalRx: "",
      signalTx: "",
      description: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (onu) {
        form.reset({
          ponSerial: onu.ponSerial ?? "",
          oltId: onu.oltId,
          distributionBoxId: onu.distributionBoxId ?? undefined,
          ponPort: onu.ponPort ?? "",
          onuId: onu.onuId ?? undefined,
          subscriptionId: onu.subscriptionId ?? undefined,
          macAddress: onu.macAddress ?? "",
          status: onu.status,
          signalRx: onu.signalRx?.toString() ?? "",
          signalTx: onu.signalTx?.toString() ?? "",
          distance: onu.distance ?? undefined,
          vlanId: onu.vlanId ?? undefined,
          bandwidthProfile: onu.bandwidthProfile ?? "",
          description: onu.description ?? "",
        });
      } else {
        form.reset({
          ponSerial: "",
          oltId: undefined,
          distributionBoxId: undefined,
          ponPort: "",
          onuId: undefined,
          macAddress: "",
          status: "offline",
          signalRx: "",
          signalTx: "",
          description: "",
        });
      }
    }
  }, [open, onu?.id, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertOnu) => {
      return await apiRequest("POST", "/api/onus", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onus'] });
      queryClient.invalidateQueries({ queryKey: ['/api/olts/stats/onu-counts'] });
      toast({ title: "Success", description: "ONU created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertOnu) => {
      return await apiRequest("PATCH", `/api/onus/${onu?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onus'] });
      queryClient.invalidateQueries({ queryKey: ['/api/olts/stats/onu-counts'] });
      toast({ title: "Success", description: "ONU updated successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertOnu) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Edit ONU" : "Add New ONU"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update ONU information" : "Add a new Optical Network Unit to your distribution box"}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            ONUs require OLT, PON Port, and unique PON Serial Number configuration
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ponSerial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PON Serial Number *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., ZTEG1234ABCD"
                        className="font-mono"
                        data-testid="input-pon-serial"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Unique PON Serial Number (GPON) or MAC (EPON)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="oltId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OLT *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-olt">
                          <SelectValue placeholder="Select OLT" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {olts?.map((olt) => (
                          <SelectItem key={olt.id} value={olt.id.toString()}>
                            {olt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ponPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PON Port *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., 0/1 or gpon-olt_1/1/1"
                        data-testid="input-pon-port"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      e.g., "0/1" (slot/port) or "gpon-olt_1/1/1"
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="onuId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ONU ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={128}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        placeholder="1-128"
                        data-testid="input-onu-id"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      ONU ID on the PON port (1-128)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="distributionBoxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distribution Box</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value ? parseInt(value) : undefined)}
                      value={field.value?.toString() ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-distribution-box">
                          <SelectValue placeholder="Select distribution box (optional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {distributionBoxes?.map((box) => (
                          <SelectItem key={box.id} value={box.id.toString()}>
                            {box.code} - {box.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                        <SelectItem value="silent">Silent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="macAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MAC Address</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., 00:11:22:33:44:55"
                        className="font-mono"
                        data-testid="input-mac-address"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Format: XX:XX:XX:XX:XX:XX (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vlanId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VLAN ID</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={1}
                        max={4094}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        placeholder="e.g., 100"
                        data-testid="input-vlan-id"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Service VLAN (1-4094)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="signalRx"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Signal RX (dBm)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., -20.5"
                        data-testid="input-signal-rx"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Received signal strength
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="signalTx"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Signal TX (dBm)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., 2.5"
                        data-testid="input-signal-tx"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Transmitted signal strength
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="distance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Distance (meters)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        min={0}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        value={field.value ?? ""}
                        placeholder="e.g., 1500"
                        data-testid="input-distance"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Distance from OLT in meters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bandwidthProfile"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bandwidth Profile</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="e.g., profile_100M"
                        data-testid="input-bandwidth-profile"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Customer name or notes"
                      data-testid="input-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update"
                  : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
