import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
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
import { insertDistributionBoxSchema, type DistributionBox, type InsertDistributionBox, type Olt } from "@shared/schema";
import { Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DistributionBoxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distributionBox?: DistributionBox | null;
  olts: Olt[];
}

export function DistributionBoxDialog({ open, onOpenChange, distributionBox, olts }: DistributionBoxDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!distributionBox;

  const form = useForm<InsertDistributionBox>({
    resolver: zodResolver(insertDistributionBoxSchema),
    defaultValues: {
      name: "",
      code: "",
      oltId: olts[0]?.id ?? 0,
      ponPort: "",
      ponSlotIndex: 0,
      latitude: "",
      longitude: "",
      address: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open && distributionBox) {
      form.reset({
        name: distributionBox.name ?? "",
        code: distributionBox.code ?? "",
        oltId: distributionBox.oltId ?? (olts[0]?.id ?? 0),
        ponPort: distributionBox.ponPort ?? "",
        ponSlotIndex: distributionBox.ponSlotIndex ?? 0,
        latitude: distributionBox.latitude ?? "",
        longitude: distributionBox.longitude ?? "",
        address: distributionBox.address ?? "",
        description: distributionBox.description ?? "",
        isActive: distributionBox.isActive ?? true,
      });
    } else if (open && !distributionBox) {
      form.reset({
        name: "",
        code: "",
        oltId: olts[0]?.id ?? 0,
        ponPort: "",
        ponSlotIndex: 0,
        latitude: "",
        longitude: "",
        address: "",
        description: "",
        isActive: true,
      });
    }
  }, [open, distributionBox?.id, form]);

  const createMutation = useMutation({
    mutationFn: (data: InsertDistributionBox) => apiRequest('POST', '/api/distribution-boxes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/distribution-boxes'] });
      toast({
        title: "Distribution Box Created",
        description: "The distribution box has been created successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create distribution box",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertDistributionBox) => apiRequest('PATCH', `/api/distribution-boxes/${distributionBox?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/distribution-boxes'] });
      toast({
        title: "Distribution Box Updated",
        description: "The distribution box has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update distribution box",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/distribution-boxes/${distributionBox?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/distribution-boxes'] });
      form.reset();
      toast({
        title: "Distribution Box Deleted",
        description: "The distribution box has been deleted successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete distribution box",
      });
    },
  });

  const onSubmit = (data: InsertDistributionBox) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this distribution box? This will affect all associated ONUs.")) {
      deleteMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Edit Distribution Box" : "Add New Distribution Box"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the distribution box information"
              : "Add a new optical distribution point (ODP) to your network"}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Each PON port can have up to 8 distribution boxes (slots 0-7). Each box supports up to 16 ONUs.
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="ODP Main Street 01" {...field} data-testid="input-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="ODP-MAIN-01" {...field} data-testid="input-code" />
                    </FormControl>
                    <FormDescription>Unique identifier</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      {olts.map((olt) => (
                        <SelectItem key={olt.id} value={olt.id.toString()}>
                          {olt.name} ({olt.vendor})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ponPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PON Port *</FormLabel>
                    <FormControl>
                      <Input placeholder="0/1" {...field} data-testid="input-pon-port" />
                    </FormControl>
                    <FormDescription>Format: slot/port (e.g., 0/1)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ponSlotIndex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PON Slot Index *</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-slot-index">
                          <SelectValue placeholder="Select slot (0-7)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6, 7].map((slot) => (
                          <SelectItem key={slot} value={slot.toString()}>
                            Slot {slot}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>0-7 (8 boxes per PON port)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Physical location of the distribution box..."
                      className="resize-none"
                      {...field}
                      data-testid="input-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0000001"
                        placeholder="-6.200000"
                        {...field}
                        data-testid="input-latitude"
                      />
                    </FormControl>
                    <FormDescription>GPS coordinate</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0000001"
                        placeholder="106.816666"
                        {...field}
                        data-testid="input-longitude"
                      />
                    </FormControl>
                    <FormDescription>GPS coordinate</FormDescription>
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
                      placeholder="Additional notes about this distribution box..."
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
                      Mark as active if this distribution box is currently operational
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
