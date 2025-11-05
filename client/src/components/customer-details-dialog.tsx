import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Plus, Edit, Trash2, Mail, Phone, MapPin } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubscriptionDialog } from "@/components/subscription-dialog";
import type { Customer, Subscription, Profile } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface CustomerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
}

export function CustomerDetailsDialog({ open, onOpenChange, customer }: CustomerDetailsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState<number | null>(null);

  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery<(Subscription & { profileName?: string })[]>({
    queryKey: ['/api/subscriptions', customer?.id],
    enabled: open && !!customer,
  });

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['/api/profiles'],
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/subscriptions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions', customer?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/subscriptions/expiring'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      toast({
        title: "Success",
        description: "Subscription deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSubscriptionToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddSubscription = () => {
    setSelectedSubscription(null);
    setSubscriptionDialogOpen(true);
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setSubscriptionDialogOpen(true);
  };

  const handleDeleteClick = (subscriptionId: number) => {
    setSubscriptionToDelete(subscriptionId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (subscriptionToDelete) {
      deleteMutation.mutate(subscriptionToDelete);
    }
  };

  if (!customer) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Full Name</p>
                    <p className="text-sm font-medium" data-testid="text-customer-name">{customer.fullName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Username</p>
                    <p className="text-sm font-medium font-mono" data-testid="text-customer-username">{customer.username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">National ID</p>
                    <p className="text-sm font-medium" data-testid="text-customer-national-id">{customer.nationalId || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <StatusBadge status={customer.status} type="customer" />
                  </div>
                  {customer.whatsapp && (
                    <div>
                      <p className="text-xs text-muted-foreground">WhatsApp</p>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm" data-testid="text-customer-whatsapp">{customer.whatsapp}</p>
                      </div>
                    </div>
                  )}
                  {customer.email && (
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm" data-testid="text-customer-email">{customer.email}</p>
                      </div>
                    </div>
                  )}
                  {customer.homeAddress && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground">Home Address</p>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                        <p className="text-sm" data-testid="text-customer-home-address">{customer.homeAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="text-base">Subscriptions</CardTitle>
                <Button onClick={handleAddSubscription} size="sm" data-testid="button-add-subscription">
                  <Plus className="mr-2 h-4 w-4" /> Add Subscription
                </Button>
              </CardHeader>
              <CardContent>
                {subscriptionsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-24 animate-pulse bg-muted rounded" />
                    ))}
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-base font-medium text-muted-foreground">No subscriptions</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Add a subscription to activate service for this customer
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subscriptions.map((subscription) => {
                      const profile = profiles.find(p => p.id === subscription.profileId);
                      return (
                        <Card key={subscription.id} data-testid={`subscription-${subscription.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={subscription.status} type="customer" />
                                  <p className="text-sm font-medium" data-testid={`text-subscription-profile-${subscription.id}`}>
                                    {profile?.name || "Unknown Profile"}
                                  </p>
                                </div>
                                <div className="grid gap-2 md:grid-cols-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Installation: </span>
                                    <span data-testid={`text-subscription-address-${subscription.id}`}>{subscription.installationAddress}</span>
                                  </div>
                                  {subscription.ipAddress && (
                                    <div>
                                      <span className="text-muted-foreground">IP: </span>
                                      <span className="font-mono" data-testid={`text-subscription-ip-${subscription.id}`}>{subscription.ipAddress}</span>
                                    </div>
                                  )}
                                  {subscription.macAddress && (
                                    <div>
                                      <span className="text-muted-foreground">MAC: </span>
                                      <span className="font-mono" data-testid={`text-subscription-mac-${subscription.id}`}>{subscription.macAddress}</span>
                                    </div>
                                  )}
                                  {subscription.expiryDate && (
                                    <div>
                                      <span className="text-muted-foreground">Expires: </span>
                                      <span data-testid={`text-subscription-expiry-${subscription.id}`}>
                                        {format(new Date(subscription.expiryDate), 'PPP')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditSubscription(subscription)}
                                  data-testid={`button-edit-subscription-${subscription.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(subscription.id)}
                                  data-testid={`button-delete-subscription-${subscription.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {customer && (
        <SubscriptionDialog
          open={subscriptionDialogOpen}
          onOpenChange={setSubscriptionDialogOpen}
          customerId={customer.id}
          subscription={selectedSubscription}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this subscription? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
