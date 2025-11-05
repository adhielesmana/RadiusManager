import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { insertSubscriptionSchema, type Subscription, type InsertSubscription, type Profile } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface SubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  subscription: Subscription | null;
}

export function SubscriptionDialog({ open, onOpenChange, customerId, subscription }: SubscriptionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['/api/profiles'],
    enabled: open,
  });

  const form = useForm<InsertSubscription>({
    resolver: zodResolver(insertSubscriptionSchema),
    defaultValues: {
      customerId: customerId,
      profileId: undefined,
      installationAddress: "",
      ipAddress: "",
      macAddress: "",
      status: "active",
      expiryDate: undefined,
    },
  });

  const profileId = form.watch("profileId");

  // Auto-calculate expiry date when profile changes (only for new subscriptions or explicit profile changes)
  useEffect(() => {
    if (!subscription && profileId) {
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        const today = new Date();
        const expiryDate = new Date(today);
        expiryDate.setDate(expiryDate.getDate() + profile.validityDays);
        form.setValue("expiryDate", expiryDate);
      }
    }
  }, [profileId, profiles, form, subscription]);

  useEffect(() => {
    if (subscription) {
      form.reset({
        customerId: subscription.customerId,
        profileId: subscription.profileId,
        installationAddress: subscription.installationAddress,
        ipAddress: subscription.ipAddress || "",
        macAddress: subscription.macAddress || "",
        status: subscription.status,
        expiryDate: subscription.expiryDate ? new Date(subscription.expiryDate) : undefined,
      });
    } else {
      form.reset({
        customerId: customerId,
        profileId: undefined,
        installationAddress: "",
        ipAddress: "",
        macAddress: "",
        status: "active",
        expiryDate: undefined,
      });
    }
  }, [subscription, customerId, form]);

  const createMutation = useMutation({
    mutationFn: (data: InsertSubscription) => apiRequest("POST", "/api/subscriptions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: "Subscription created successfully",
      });
      onOpenChange(false);
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
    mutationFn: (data: InsertSubscription) => apiRequest("PATCH", `/api/subscriptions/${subscription?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: "Subscription updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertSubscription) => {
    if (subscription) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subscription ? "Edit Subscription" : "Add New Subscription"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Service Details</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="profileId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Profile *</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-profile">
                            <SelectValue placeholder="Select a profile" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {profiles.filter(p => p.isActive).map((profile) => (
                            <SelectItem key={profile.id} value={profile.id.toString()}>
                              {profile.name} - ${Number(profile.price).toFixed(2)}/
                              {profile.validityDays} days
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                          <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal"
                            data-testid="button-expiry-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : "Auto-calculated from profile"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Automatically calculated based on profile validity days
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Installation Details</h3>
              <FormField
                control={form.control}
                name="installationAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Installation Address *</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="123 Main Street, City, State" className="min-h-20" data-testid="input-installation-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="ipAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IP Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="192.168.1.100" className="font-mono" data-testid="input-ip-address" />
                      </FormControl>
                      <FormDescription>
                        Leave empty for router auto-assignment
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="macAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MAC Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="00:11:22:33:44:55" className="font-mono" data-testid="input-mac-address" />
                      </FormControl>
                      <FormDescription>Format: XX:XX:XX:XX:XX:XX</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-subscription">
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : subscription ? "Update Subscription" : "Add Subscription"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
