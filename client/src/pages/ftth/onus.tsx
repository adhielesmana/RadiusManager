import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Eye } from "lucide-react";
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
import { useState } from "react";
import type { Onu, DistributionBox, Olt } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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

  const { data: onus, isLoading } = useQuery<Onu[]>({
    queryKey: ['/api/onus'],
  });

  const { data: distributionBoxes } = useQuery<DistributionBox[]>({
    queryKey: ['/api/distribution-boxes'],
  });

  const { data: olts } = useQuery<Olt[]>({
    queryKey: ['/api/olts'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/onus/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onus'] });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading ONUs...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            ONUs (Optical Network Units)
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage customer premises equipment in your fiber network
          </p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-onu">
          <Plus className="h-4 w-4 mr-2" />
          Add ONU
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PON Serial</TableHead>
              <TableHead>OLT</TableHead>
              <TableHead>PON Port</TableHead>
              <TableHead>ONU ID</TableHead>
              <TableHead>Distribution Box</TableHead>
              <TableHead>MAC Address</TableHead>
              <TableHead>Signal RX</TableHead>
              <TableHead>Signal TX</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!onus || onus.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  No ONUs found. Add your first ONU to get started.
                </TableCell>
              </TableRow>
            ) : (
              onus.map((onu) => {
                const boxInfo = getBoxInfo(onu.distributionBoxId);
                return (
                  <TableRow key={onu.id} data-testid={`row-onu-${onu.id}`}>
                    <TableCell className="font-mono text-sm font-medium">
                      {onu.ponSerial}
                    </TableCell>
                    <TableCell className="text-sm">{getOltName(onu.oltId)}</TableCell>
                    <TableCell className="font-mono text-xs">{onu.ponPort}</TableCell>
                    <TableCell>
                      {onu.onuId ? (
                        <Badge variant="secondary">ID {onu.onuId}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{boxInfo.code}</div>
                        {boxInfo.name && (
                          <div className="text-xs text-muted-foreground">{boxInfo.name}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {onu.macAddress || <span className="text-muted-foreground">N/A</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {onu.signalRx ? `${onu.signalRx} dBm` : <span className="text-muted-foreground">N/A</span>}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {onu.signalTx ? `${onu.signalTx} dBm` : <span className="text-muted-foreground">N/A</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(onu.status)}>
                        {onu.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
      </div>

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
