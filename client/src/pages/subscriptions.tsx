import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Eye, Search } from "lucide-react";
import type { Subscription, Customer, Profile } from "@shared/schema";
import { CustomerDetailsDialog } from "@/components/customer-details-dialog";

export default function Subscriptions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery<Subscription[]>({
    queryKey: ['/api/subscriptions'],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['/api/profiles'],
  });

  // Create lookup maps for efficient joining
  const customerMap = new Map(customers.map(c => [c.id, c]));
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  // Filter subscriptions based on search
  const filteredSubscriptions = subscriptions.filter(subscription => {
    if (!searchTerm) return true;
    const customer = customerMap.get(subscription.customerId);
    const profile = profileMap.get(subscription.profileId);
    
    return (
      subscription.subscriptionId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.nationalId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscription.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subscription.installationAddress.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "outline" | "secondary", label: string }> = {
      new_request: { variant: "outline", label: "New Request" },
      active: { variant: "default", label: "Active" },
      suspend: { variant: "secondary", label: "Suspend" },
      dismantle: { variant: "destructive", label: "Dismantle" },
    };
    
    const config = variants[status] || { variant: "outline", label: status };
    return (
      <Badge variant={config.variant} data-testid={`status-${status}`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground">Manage all customer subscriptions and service plans</p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <CardTitle>All Subscriptions</CardTitle>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID, customer, profile, or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-subscriptions"
            />
          </div>
        </CardHeader>
        <CardContent>
          {subscriptionsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading subscriptions...</div>
          ) : filteredSubscriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No subscriptions found matching your search" : "No subscriptions yet"}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subscription ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>National ID</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Installation Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubscriptions.map((subscription) => {
                    const customer = customerMap.get(subscription.customerId);
                    const profile = profileMap.get(subscription.profileId);
                    
                    return (
                      <TableRow key={subscription.id} data-testid={`row-subscription-${subscription.id}`}>
                        <TableCell className="font-mono font-semibold" data-testid={`text-subscription-id-${subscription.id}`}>
                          {subscription.subscriptionId}
                        </TableCell>
                        <TableCell data-testid={`text-customer-name-${subscription.id}`}>
                          {customer?.fullName || "N/A"}
                        </TableCell>
                        <TableCell className="font-mono text-sm" data-testid={`text-national-id-${subscription.id}`}>
                          {customer?.nationalId || "N/A"}
                        </TableCell>
                        <TableCell data-testid={`text-profile-${subscription.id}`}>
                          {profile?.name || "N/A"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" data-testid={`text-address-${subscription.id}`}>
                          {subscription.installationAddress}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(subscription.status)}
                        </TableCell>
                        <TableCell data-testid={`text-expiry-${subscription.id}`}>
                          {subscription.expiryDate
                            ? new Date(subscription.expiryDate).toLocaleDateString()
                            : "N/A"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedCustomer(customer || null)}
                            data-testid={`button-view-customer-${subscription.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerDetailsDialog
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
        customer={selectedCustomer}
      />
    </div>
  );
}
