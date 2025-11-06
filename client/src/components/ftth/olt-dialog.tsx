import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { insertOltSchema, type Olt, type InsertOlt, type Pop } from "@shared/schema";
import { Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OltDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  olt?: Olt | null;
  pops: Pop[];
}

export function OltDialog({ open, onOpenChange, olt, pops }: OltDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!olt;

  const form = useForm<InsertOlt>({
    resolver: zodResolver(insertOltSchema),
    defaultValues: {
      name: olt?.name ?? "",
      vendor: olt?.vendor ?? "ZTE",
      model: olt?.model ?? "",
      popId: olt?.popId ?? (pops[0]?.id ?? 0),
      ipAddress: olt?.ipAddress ?? "",
      telnetPort: olt?.telnetPort ?? 23,
      telnetUsername: olt?.telnetUsername ?? "",
      telnetPassword: olt?.telnetPassword ?? "",
      snmpCommunity: olt?.snmpCommunity ?? "",
      snmpPort: olt?.snmpPort ?? 161,
      totalPonSlots: olt?.totalPonSlots ?? 16,
      portsPerSlot: olt?.portsPerSlot ?? 16,
      description: olt?.description ?? "",
      telnetEnabled: olt?.telnetEnabled ?? true,
      snmpEnabled: olt?.snmpEnabled ?? true,
      isActive: olt?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertOlt) => apiRequest('/api/olts', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/olts'] });
      toast({
        title: "OLT Created",
        description: "The Optical Line Terminal has been created successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create OLT",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertOlt) => apiRequest(`/api/olts/${olt?.id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/olts'] });
      toast({
        title: "OLT Updated",
        description: "The Optical Line Terminal has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update OLT",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/api/olts/${olt?.id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/olts'] });
      toast({
        title: "OLT Deleted",
        description: "The Optical Line Terminal has been deleted successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete OLT",
      });
    },
  });

  const onSubmit = (data: InsertOlt) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this OLT? This will affect all associated distribution boxes and ONUs.")) {
      deleteMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Edit OLT" : "Add New OLT"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the Optical Line Terminal configuration"
              : "Add a new GPON/EPON device to your network"}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Security Notice: OLT credentials are stored in plaintext. Use strong passwords and restrict database access.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="connection">Connection</TabsTrigger>
                <TabsTrigger value="capacity">Capacity</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Main OLT 01" {...field} data-testid="input-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="popId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>POP Location *</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(parseInt(value))}
                          value={field.value?.toString()}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-pop">
                              <SelectValue placeholder="Select POP" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {pops.map((pop) => (
                              <SelectItem key={pop.id} value={pop.id.toString()}>
                                {pop.name} ({pop.code})
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
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-vendor">
                              <SelectValue placeholder="Select vendor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ZTE">ZTE (GPON)</SelectItem>
                            <SelectItem value="HIOSO">HIOSO (EPON)</SelectItem>
                            <SelectItem value="Huawei">Huawei</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="C320" {...field} data-testid="input-model" />
                        </FormControl>
                        <FormDescription>e.g., C320, C600, etc.</FormDescription>
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
                        <Textarea
                          placeholder="Additional notes about this OLT..."
                          className="resize-none"
                          {...field}
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active Status</FormLabel>
                        <FormDescription>
                          Mark as active if this OLT is currently operational
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-is-active"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="connection" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="ipAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.1.100" {...field} data-testid="input-ip-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telnetPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telnet Port</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 23)}
                            data-testid="input-telnet-port"
                          />
                        </FormControl>
                        <FormDescription>Default: 23</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="telnetEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable Telnet</FormLabel>
                        <FormDescription>
                          Allow telnet connection to this OLT for management
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-telnet-enabled"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('telnetEnabled') && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="telnetUsername"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telnet Username</FormLabel>
                          <FormControl>
                            <Input placeholder="admin" {...field} data-testid="input-telnet-username" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="telnetPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telnet Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} data-testid="input-telnet-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="snmpEnabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Enable SNMP</FormLabel>
                        <FormDescription>
                          Allow SNMP monitoring for this OLT
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-snmp-enabled"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch('snmpEnabled') && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="snmpCommunity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SNMP Community String</FormLabel>
                          <FormControl>
                            <Input placeholder="public" {...field} data-testid="input-snmp-community" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="snmpPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SNMP Port</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 161)}
                              data-testid="input-snmp-port"
                            />
                          </FormControl>
                          <FormDescription>Default: 161</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="capacity" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="totalPonSlots"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total PON Slots *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 16)}
                            data-testid="input-total-pon-slots"
                          />
                        </FormControl>
                        <FormDescription>Number of PON card slots (e.g., 16)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="portsPerSlot"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ports per Slot *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 16)}
                            data-testid="input-ports-per-slot"
                          />
                        </FormControl>
                        <FormDescription>Ports per PON card (e.g., 16)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="rounded-lg border p-4 bg-muted/50">
                  <h4 className="font-medium mb-2">Capacity Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total PON Ports:</span>
                      <span className="font-mono font-medium">
                        {form.watch('totalPonSlots') * form.watch('portsPerSlot')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Distribution Boxes per Port:</span>
                      <span className="font-mono font-medium">8 max</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ONUs per Box:</span>
                      <span className="font-mono font-medium">16 max</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-muted-foreground font-medium">Max Total ONUs:</span>
                      <span className="font-mono font-semibold">
                        {form.watch('totalPonSlots') * form.watch('portsPerSlot') * 8 * 16}
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="gap-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isPending}
                  data-testid="button-delete"
                >
                  {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit">
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
