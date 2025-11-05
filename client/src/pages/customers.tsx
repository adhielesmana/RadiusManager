import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Plus, Search, MoreVertical, Eye, Edit, Power, PowerOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerDialog } from "@/components/customer-dialog";
import { CustomerDetailsDialog } from "@/components/customer-details-dialog";
import type { Customer } from "@shared/schema";

export default function Customers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [customerToView, setCustomerToView] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery<(Customer & { subscriptionCount?: number })[]>({
    queryKey: ['/api/customers'],
  });

  const filteredCustomers = customers.filter(customer =>
    customer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setIsDialogOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDialogOpen(true);
  };

  const handleViewDetails = (customer: Customer) => {
    setCustomerToView(customer);
    setIsDetailsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-customers">Customers</h1>
          <p className="text-sm text-muted-foreground">Manage your ISP customers and subscriptions</p>
        </div>
        <Button onClick={handleAddCustomer} data-testid="button-add-customer">
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customers by name, username, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-customers"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-base font-medium text-muted-foreground">No customers found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? "Try adjusting your search" : "Add your first customer to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subscriptions</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contact</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b border-border hover-elevate" data-testid={`customer-row-${customer.id}`}>
                      <td className="px-4 py-3">
                        <StatusBadge status={customer.status} type="customer" />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-medium" data-testid={`customer-name-${customer.id}`}>{customer.fullName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{customer.username}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm" data-testid={`customer-subscription-count-${customer.id}`}>
                          {customer.subscriptionCount || 0} subscription{customer.subscriptionCount !== 1 ? 's' : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          {customer.whatsapp && <p className="text-sm">{customer.whatsapp}</p>}
                          {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm max-w-xs truncate">{customer.homeAddress || 'N/A'}</p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${customer.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(customer)} data-testid={`button-view-${customer.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditCustomer(customer)} data-testid={`button-edit-${customer.id}`}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            {customer.status === 'active' ? (
                              <DropdownMenuItem data-testid={`button-suspend-${customer.id}`}>
                                <PowerOff className="mr-2 h-4 w-4" /> Suspend Service
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem data-testid={`button-reactivate-${customer.id}`}>
                                <Power className="mr-2 h-4 w-4" /> Reactivate Service
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        customer={selectedCustomer}
      />

      <CustomerDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        customer={customerToView}
      />
    </div>
  );
}
