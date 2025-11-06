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
import { DistributionBoxDialog } from "@/components/ftth/distribution-box-dialog";
import { DistributionBoxDetailDialog } from "@/components/ftth/distribution-box-detail-dialog";
import { useState } from "react";
import type { DistributionBox, Olt, Pop } from "@shared/schema";

export default function DistributionBoxesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<DistributionBox | null>(null);
  const [viewingBox, setViewingBox] = useState<DistributionBox | null>(null);

  const { data: distributionBoxes, isLoading } = useQuery<DistributionBox[]>({
    queryKey: ['/api/distribution-boxes'],
  });

  const { data: olts } = useQuery<Olt[]>({
    queryKey: ['/api/olts'],
  });

  const { data: pops } = useQuery<Pop[]>({
    queryKey: ['/api/pops'],
  });

  const handleAdd = () => {
    setEditingBox(null);
    setDialogOpen(true);
  };

  const handleEdit = (box: DistributionBox) => {
    setEditingBox(box);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingBox(null);
  };

  const handleViewDetails = (box: DistributionBox) => {
    setViewingBox(box);
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setViewingBox(null);
  };

  const getOltInfo = (oltId: number) => {
    const olt = olts?.find(o => o.id === oltId);
    if (!olt) return { name: 'Unknown', popName: '' };
    const pop = pops?.find(p => p.id === olt.popId);
    return { name: olt.name, popName: pop?.name || '' };
  };

  const viewingOltName = viewingBox ? getOltInfo(viewingBox.oltId).name : undefined;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading distribution boxes...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Distribution Boxes (ODPs)
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage optical distribution points in your fiber network
          </p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-distribution-box">
          <Plus className="h-4 w-4 mr-2" />
          Add Distribution Box
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>OLT</TableHead>
              <TableHead>PON Port</TableHead>
              <TableHead>Slot Index</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Capacity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!distributionBoxes || distributionBoxes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No distribution boxes found. Add your first ODP to get started.
                </TableCell>
              </TableRow>
            ) : (
              distributionBoxes.map((box) => {
                const oltInfo = getOltInfo(box.oltId);
                return (
                  <TableRow key={box.id} data-testid={`row-distribution-box-${box.id}`}>
                    <TableCell className="font-mono text-sm font-medium">
                      {box.code}
                    </TableCell>
                    <TableCell>{box.name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{oltInfo.name}</div>
                        {oltInfo.popName && (
                          <div className="text-xs text-muted-foreground">{oltInfo.popName}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {box.ponPort}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">Slot {box.ponSlotIndex}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {box.address || (box.latitude && box.longitude ? (
                        <span className="text-xs font-mono">
                          {parseFloat(box.latitude).toFixed(5)}, {parseFloat(box.longitude).toFixed(5)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      ))}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-xs">
                          0/{box.maxOnus} ONUs
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={box.status === 'active' ? "default" : "secondary"}>
                        {box.status.charAt(0).toUpperCase() + box.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(box)}
                          data-testid={`button-view-distribution-box-${box.id}`}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(box)}
                          data-testid={`button-edit-distribution-box-${box.id}`}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
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

      <DistributionBoxDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        distributionBox={editingBox}
        olts={olts || []}
      />
      
      <DistributionBoxDetailDialog
        open={detailDialogOpen}
        onOpenChange={handleCloseDetailDialog}
        box={viewingBox}
        oltName={viewingOltName}
      />
    </div>
  );
}
