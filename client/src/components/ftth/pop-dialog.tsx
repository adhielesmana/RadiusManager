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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { insertPopSchema, type Pop, type InsertPop } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface PopDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pop?: Pop | null;
}

export function PopDialog({ open, onOpenChange, pop }: PopDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!pop;

  const form = useForm<InsertPop>({
    resolver: zodResolver(insertPopSchema),
    defaultValues: {
      name: "",
      code: "",
      address: "",
      latitude: "",
      longitude: "",
      contactPerson: "",
      contactPhone: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (open && pop) {
      form.reset({
        name: pop.name || "",
        code: pop.code || "",
        address: pop.address || "",
        latitude: pop.latitude || "",
        longitude: pop.longitude || "",
        contactPerson: pop.contactPerson || "",
        contactPhone: pop.contactPhone || "",
        description: pop.description || "",
        isActive: pop.isActive ?? true,
      });
    } else if (open && !pop) {
      form.reset({
        name: "",
        code: "",
        address: "",
        latitude: "",
        longitude: "",
        contactPerson: "",
        contactPhone: "",
        description: "",
        isActive: true,
      });
    }
  }, [open, pop?.id, form]);

  const createMutation = useMutation({
    mutationFn: (data: InsertPop) => apiRequest('POST', '/api/pops', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pops'] });
      toast({
        title: "POP Created",
        description: "The Point of Presence has been created successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create POP",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertPop) => apiRequest('PATCH', `/api/pops/${pop?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pops'] });
      toast({
        title: "POP Updated",
        description: "The Point of Presence has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update POP",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest('DELETE', `/api/pops/${pop?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pops'] });
      form.reset();
      toast({
        title: "POP Deleted",
        description: "The Point of Presence has been deleted successfully.",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete POP",
      });
    },
  });

  const onSubmit = (data: InsertPop) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this POP? This will also affect associated OLTs.")) {
      deleteMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Edit POP" : "Add New POP"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the Point of Presence information"
              : "Add a new physical location for your FTTH equipment"}
          </DialogDescription>
        </DialogHeader>

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
                      <Input placeholder="Main Office" {...field} data-testid="input-name" />
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
                      <Input placeholder="MAIN" {...field} data-testid="input-code" />
                    </FormControl>
                    <FormDescription>Unique identifier (e.g., MAIN, BRANCH1)</FormDescription>
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
                      placeholder="Full address of the location..."
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
                    <FormDescription>GPS coordinate (decimal)</FormDescription>
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
                    <FormDescription>GPS coordinate (decimal)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} data-testid="input-contact-person" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+62 812 3456 7890" {...field} data-testid="input-contact-phone" />
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
                    <Textarea
                      placeholder="Additional notes about this location..."
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
                      Mark as active if this location is currently operational
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
