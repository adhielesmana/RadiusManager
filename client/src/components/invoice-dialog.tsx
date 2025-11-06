import { useEffect, useLayoutEffect, useState } from "react";
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
import { insertInvoiceSchema, type Customer, type Profile, type Subscription, type InsertInvoice } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceDialog({ open, onOpenChange }: InvoiceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
    enabled: open,
  });

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['/api/profiles'],
    enabled: open,
  });

  const form = useForm<InsertInvoice & { taxPercentage?: number }>({
    resolver: zodResolver(
      insertInvoiceSchema.extend({
        taxPercentage: z.number().min(0).optional(),
      })
    ),
    defaultValues: {
      customerId: undefined,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      amount: "0.00",
      tax: "0.00",
      total: "0.00",
      status: "pending",
      subscriptionId: undefined,
      notes: "",
      taxPercentage: 0,
    },
  });

  const formCustomerId = form.watch("customerId");

  const { data: subscriptions = [], isLoading: isLoadingSubscriptions } = useQuery<Subscription[]>({
    queryKey: ['/api/subscriptions/customer', formCustomerId],
    enabled: !!formCustomerId,
  });
  const subscriptionId = form.watch("subscriptionId");
  const amount = parseFloat(String(form.watch("amount") || "0"));
  const taxPercentage = form.watch("taxPercentage") || 0;

  // Update selected customer when form customerId changes
  useEffect(() => {
    if (!formCustomerId) {
      setSelectedCustomer(null);
      form.setValue("subscriptionId", undefined);
      return;
    }
    
    const customer = customers.find(c => c.id === formCustomerId);
    setSelectedCustomer(customer || null);
    
    // Clear subscription when customer changes
    form.setValue("subscriptionId", undefined);
    form.setValue("amount", "0.00");
    form.setValue("notes", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formCustomerId, customers]);

  // Auto-populate form when subscription is selected
  useEffect(() => {
    if (!subscriptionId) {
      return;
    }
    
    const subscription = subscriptions.find(s => s.id === subscriptionId);
    if (subscription) {
      const profile = profiles.find(p => p.id === subscription.profileId);
      if (profile) {
        const profilePrice = typeof profile.price === 'string' ? parseFloat(profile.price) : profile.price;
        form.setValue("amount", profilePrice.toFixed(2));
        
        // Set notes with profile and subscription details
        const quotaText = profile.dataQuota ? `${profile.dataQuota} GB` : "Unlimited";
        form.setValue("notes", `${profile.name} - ${profile.validityDays} days\nInstallation: ${subscription.installationAddress}\nDownload: ${profile.downloadSpeed} Mbps, Upload: ${profile.uploadSpeed} Mbps\nData Quota: ${quotaText}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionId, subscriptions, profiles]);

  // Auto-calculate total when amount or tax changes
  useEffect(() => {
    const taxAmount = (amount * taxPercentage) / 100;
    const totalAmount = amount + taxAmount;
    form.setValue("tax", taxAmount.toFixed(2));
    form.setValue("total", totalAmount.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, taxPercentage]);

  // Reset form when dialog opens (useLayoutEffect for synchronous update)
  useLayoutEffect(() => {
    if (open) {
      const freshDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      // Clear selected customer state synchronously
      setSelectedCustomer(null);
      
      form.reset({
        customerId: undefined,
        dueDate: freshDueDate,
        amount: "0.00",
        tax: "0.00",
        total: "0.00",
        status: "pending",
        subscriptionId: undefined,
        notes: "",
        taxPercentage: 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createMutation = useMutation({
    mutationFn: (data: InsertInvoice) => apiRequest("POST", "/api/invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: "Invoice generated successfully",
      });
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

  const onSubmit = (data: InsertInvoice & { taxPercentage?: number }) => {
    const { taxPercentage, ...invoiceData } = data;
    // Ensure dates are properly formatted
    const submitData = {
      ...invoiceData,
      dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined,
      paidDate: invoiceData.paidDate ? new Date(invoiceData.paidDate) : undefined,
      billingPeriodStart: invoiceData.billingPeriodStart ? new Date(invoiceData.billingPeriodStart) : undefined,
      billingPeriodEnd: invoiceData.billingPeriodEnd ? new Date(invoiceData.billingPeriodEnd) : undefined,
    };
    createMutation.mutate(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer *</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-customer">
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.fullName} ({customer.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Invoice number will be auto-generated (Format: INVYYMMDDNNNNN)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedCustomer && (
              <div className="p-4 bg-muted rounded-md space-y-2">
                <p className="text-sm font-medium">Customer Details</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Name: {selectedCustomer.fullName}</p>
                  <p>Email: {selectedCustomer.email || 'N/A'}</p>
                  <p>Username: {selectedCustomer.username}</p>
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="subscriptionId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subscription *</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value?.toString() || ""}
                    disabled={!formCustomerId}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-subscription">
                        <SelectValue placeholder={
                          !formCustomerId 
                            ? "Select a customer first" 
                            : isLoadingSubscriptions 
                              ? "Loading subscriptions..." 
                              : subscriptions.length === 0
                                ? "No subscriptions available"
                                : "Select subscription"
                        } />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {subscriptions.map((subscription) => {
                        const profile = profiles.find(p => p.id === subscription.profileId);
                        return (
                          <SelectItem key={subscription.id} value={subscription.id.toString()}>
                            {profile?.name || 'Unknown Profile'} - {subscription.installationAddress} ({subscription.status})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {!formCustomerId 
                      ? "Please select a customer first" 
                      : subscriptions.length === 0 && !isLoadingSubscriptions
                        ? "This customer has no subscriptions"
                        : "Select the subscription to bill"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Due Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="justify-start text-left font-normal"
                            data-testid="button-due-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(new Date(field.value), "PPP") : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        data-testid="input-amount"
                      />
                    </FormControl>
                    <FormDescription>Based on subscription's profile</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax (%)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="0"
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        value={field.value || 0}
                        data-testid="input-tax"
                      />
                    </FormControl>
                    <FormDescription>Tax percentage (e.g., 15 for 15%)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Amount</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly
                        className="bg-muted"
                        data-testid="input-tax-amount"
                      />
                    </FormControl>
                    <FormDescription>Auto-calculated</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="total"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Amount *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        readOnly
                        className="font-bold text-lg bg-muted"
                        data-testid="input-total"
                      />
                    </FormControl>
                    <FormDescription>Amount + Tax</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Additional notes about the invoice"
                      className="resize-none"
                      rows={4}
                      data-testid="input-notes"
                    />
                  </FormControl>
                  <FormDescription>Auto-populated from subscription details</FormDescription>
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
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-generate">
                {createMutation.isPending ? "Generating..." : "Generate Invoice"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
