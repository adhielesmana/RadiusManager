import { useQuery } from "@tanstack/react-query";
import { Plus, Eye, Pencil } from "lucide-react";
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
import { OltDialog } from "@/components/ftth/olt-dialog";
import { OltDetailDialog } from "@/components/ftth/olt-detail-dialog";
import { useState } from "react";
import type { Olt, Pop } from "@shared/schema";

export default function OltsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingOlt, setEditingOlt] = useState<Olt | null>(null);
  const [viewingOlt, setViewingOlt] = useState<Olt | null>(null);

  const { data: olts, isLoading } = useQuery<Olt[]>({
    queryKey: ['/api/olts'],
  });

  const { data: pops } = useQuery<Pop[]>({
    queryKey: ['/api/pops'],
  });

  const handleAdd = () => {
    setEditingOlt(null);
    setDialogOpen(true);
  };

  const handleEdit = (olt: Olt) => {
    setEditingOlt(olt);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingOlt(null);
  };

  const handleViewDetails = (olt: Olt) => {
    setViewingOlt(olt);
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setViewingOlt(null);
  };

  const getPopName = (popId: number) => {
    return pops?.find(p => p.id === popId)?.name || 'Unknown';
  };

  const viewingPopName = viewingOlt ? getPopName(viewingOlt.popId) : undefined;

  const getVendorBadgeColor = (vendor: string) => {
    switch (vendor) {
      case 'ZTE':
        return 'default';
      case 'HIOSO':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading OLTs...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">OLTs (Optical Line Terminals)</h1>
          <p className="text-sm text-muted-foreground">
            Manage your GPON/EPON equipment and configure network access
          </p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-olt">
          <Plus className="h-4 w-4 mr-2" />
          Add OLT
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>POP Location</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>PON Slots</TableHead>
              <TableHead>Management</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!olts || olts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No OLTs found. Add your first Optical Line Terminal to get started.
                </TableCell>
              </TableRow>
            ) : (
              olts.map((olt) => (
                <TableRow key={olt.id} data-testid={`row-olt-${olt.id}`}>
                  <TableCell className="font-medium">{olt.name}</TableCell>
                  <TableCell>
                    <Badge variant={getVendorBadgeColor(olt.vendor)}>
                      {olt.vendor}
                    </Badge>
                  </TableCell>
                  <TableCell>{getPopName(olt.popId)}</TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{olt.ipAddress}</span>
                    {olt.telnetPort !== 23 && (
                      <span className="text-xs text-muted-foreground ml-1">:{olt.telnetPort}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {olt.totalPonSlots} slots
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {olt.portsPerSlot}/slot
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {olt.telnetEnabled && (
                        <Badge variant="outline" className="text-xs w-fit">Telnet</Badge>
                      )}
                      {olt.snmpEnabled && (
                        <Badge variant="outline" className="text-xs w-fit">SNMP</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={olt.isActive ? "default" : "secondary"}>
                      {olt.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(olt)}
                        data-testid={`button-view-olt-${olt.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(olt)}
                        data-testid={`button-edit-olt-${olt.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <OltDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        olt={editingOlt}
        pops={pops || []}
      />
      
      <OltDetailDialog
        open={detailDialogOpen}
        onOpenChange={handleCloseDetailDialog}
        olt={viewingOlt}
        popName={viewingPopName}
      />
    </div>
  );
}
