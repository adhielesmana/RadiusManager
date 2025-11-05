import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Plus, Search, Eye } from "lucide-react";
import { TicketDialog } from "@/components/ticket-dialog";
import type { Ticket } from "@shared/schema";

export default function Tickets() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: tickets = [], isLoading } = useQuery<(Ticket & { customerName: string })[]>({
    queryKey: ['/api/tickets'],
  });

  const filteredTickets = tickets.filter(ticket =>
    ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateTicket = () => {
    setSelectedTicket(null);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-tickets">Support Tickets</h1>
          <p className="text-sm text-muted-foreground">Track and resolve customer issues</p>
        </div>
        <Button onClick={handleCreateTicket} data-testid="button-create-ticket">
          <Plus className="mr-2 h-4 w-4" /> Create Ticket
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tickets by number, subject, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-tickets"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse bg-muted rounded" />
              ))}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-base font-medium text-muted-foreground">No tickets found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? "Try adjusting your search" : "Create your first ticket to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ticket #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Created</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="border-b border-border hover-elevate" data-testid={`ticket-row-${ticket.id}`}>
                      <td className="px-4 py-3">
                        <p className="text-sm font-mono font-medium">{ticket.ticketNumber}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{ticket.customerName}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm max-w-xs truncate">{ticket.subject}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm capitalize">{ticket.category.replace(/_/g, ' ')}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ticket.priority} type="priority" />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ticket.status} type="ticket" />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" data-testid={`button-view-ticket-${ticket.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <TicketDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        ticket={selectedTicket}
      />
    </div>
  );
}
