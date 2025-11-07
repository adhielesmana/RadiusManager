import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Eye, X } from "lucide-react";
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
import { OnuDialog } from "@/components/ftth/onu-dialog";
import { OnuDetailDialog } from "@/components/ftth/onu-detail-dialog";
import { useState, useMemo } from "react";
import type { Onu, DistributionBox, Olt, Subscription, Customer } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
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

export default function OnusPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingOnu, setEditingOnu] = useState<Onu | null>(null);
  const [viewingOnu, setViewingOnu] = useState<Onu | null>(null);
  const [deletingOnu, setDeletingOnu] = useState<Onu | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  
  // Get filter from URL query params
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const oltIdParam = urlParams.get('oltId');
  const filterOltId = oltIdParam && !isNaN(parseInt(oltIdParam)) ? parseInt(oltIdParam) : null;

  const { data: onus, isLoading } = useQuery<Onu[]>({
    queryKey: ['/api/onus'],
  });

  const { data: distributionBoxes } = useQuery<DistributionBox[]>({
    queryKey: ['/api/distribution-boxes'],
  });

  const { data: olts } = useQuery<Olt[]>({
    queryKey: ['/api/olts'],
  });

  const { data: subscriptions } = useQuery<Subscription[]>({
    queryKey: ['/api/subscriptions'],
  });

  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/onus/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onus'] });
      queryClient.invalidateQueries({ queryKey: ['/api/olts/stats/onu-counts'] });
      toast({ title: "Success", description: "ONU deleted successfully" });
      setDeletingOnu(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    setEditingOnu(null);
    setDialogOpen(true);
  };

  const handleEdit = (onu: Onu) => {
    setEditingOnu(onu);
    setDialogOpen(true);
  };

  const handleDelete = (onu: Onu) => {
    setDeletingOnu(onu);
  };

  const confirmDelete = () => {
    if (deletingOnu) {
      deleteMutation.mutate(deletingOnu.id);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingOnu(null);
  };

  const handleViewDetails = (onu: Onu) => {
    setViewingOnu(onu);
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setViewingOnu(null);
  };

  const getBoxInfo = (boxId: number | null) => {
    if (!boxId) return { code: 'N/A', name: '', oltName: '' };
    const box = distributionBoxes?.find(b => b.id === boxId);
    if (!box) return { code: 'Unknown', name: '', oltName: '' };
    const olt = olts?.find(o => o.id === box.oltId);
    return { code: box.code, name: box.name, oltName: olt?.name || '' };
  };

  const getOltName = (oltId: number) => {
    const olt = olts?.find(o => o.id === oltId);
    return olt?.name || 'Unknown';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'default';
      case 'offline': return 'secondary';
      case 'silent': return 'destructive';
      default: return 'outline';
    }
  };

  const viewingOltName = viewingOnu ? getOltName(viewingOnu.oltId) : undefined;
  const viewingBoxName = viewingOnu ? getBoxInfo(viewingOnu.distributionBoxId).code : undefined;

  // Filter ONUs by OLT if filterOltId is set
  const filteredOnus = useMemo(() => {
    if (!onus) return [];
    if (filterOltId === null) return onus;
    return onus.filter(onu => onu.oltId === filterOltId);
  }, [onus, filterOltId]);

  const clearFilter = () => {
    setLocation('/ftth/onus');
  };

  const getCustomerInfo = (subscriptionId: number | null) => {
    if (!subscriptionId) return null;
    const subscription = subscriptions?.find(s => s.id === subscriptionId);
    if (!subscription) return null;
    const customer = customers?.find(c => c.id === subscription.customerId);
    return customer ? { name: customer.fullName, subscriptionId: subscription.subscriptionId } : null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading ONUs...</p>
      </div>
    );
  }

  return (
    <div className="py-6 space-y-6">
      <div className="flex items-center justify-between px-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            ONUs (Optical Network Units)
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage customer premises equipment in your fiber network
          </p>
          {filterOltId && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                Filtered by OLT: {getOltName(filterOltId)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={clearFilter}
                  data-testid="button-clear-filter"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            </div>
          )}
        </div>
        <Button onClick={handleAdd} data-testid="button-add-onu">
          <Plus className="h-4 w-4 mr-2" />
          Add ONU
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PON Serial</TableHead>
            <TableHead>OLT</TableHead>
            <TableHead>ODC</TableHead>
            <TableHead>ONU ID</TableHead>
            <TableHead>Distribution Box</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Signal RX</TableHead>
            <TableHead>Signal TX</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {!filteredOnus || filteredOnus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  {filterOltId 
                    ? `No ONUs found for ${getOltName(filterOltId)}.`
                    : 'No ONUs found. Add your first ONU to get started.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredOnus.map((onu) => {
                const boxInfo = getBoxInfo(onu.distributionBoxId);
                const customerInfo = getCustomerInfo(onu.subscriptionId);
                return (
                  <TableRow key={onu.id} data-testid={`row-onu-${onu.id}`}>
                    <TableCell className="font-mono text-sm font-medium whitespace-nowrap">
                      {onu.ponSerial}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{getOltName(onu.oltId)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {(onu as any).odcNumber ? (
                        <Badge variant="outline" className="font-mono">
                          ODC {(onu as any).odcNumber}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {onu.onuId ? (
                        <Badge variant="secondary">ID {onu.onuId}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <span className="font-medium">{boxInfo.code}</span>
                      {boxInfo.name && (
                        <span className="text-xs text-muted-foreground ml-1">({boxInfo.name})</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {customerInfo ? (
                        <span className="text-sm">
                          <span className="font-medium">{customerInfo.name}</span>
                          <span className="text-xs text-muted-foreground font-mono ml-1">({customerInfo.subscriptionId})</span>
                        </span>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Unbound
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm whitespace-nowrap">
                      {onu.signalRx ? `${onu.signalRx} dBm` : <span className="text-muted-foreground">N/A</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm whitespace-nowrap">
                      {onu.signalTx ? `${onu.signalTx} dBm` : <span className="text-muted-foreground">N/A</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant={getStatusColor(onu.status)}>
                        {onu.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(onu)}
                          data-testid={`button-view-onu-${onu.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(onu)}
                          data-testid={`button-edit-onu-${onu.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(onu)}
                          data-testid={`button-delete-onu-${onu.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
      </Table>

      <OnuDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        onu={editingOnu}
      />

      <OnuDetailDialog
        open={detailDialogOpen}
        onOpenChange={handleCloseDetailDialog}
        onu={viewingOnu}
        oltName={viewingOltName}
        boxName={viewingBoxName}
      />

      <AlertDialog open={!!deletingOnu} onOpenChange={() => setDeletingOnu(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the ONU "{deletingOnu?.ponSerial}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
