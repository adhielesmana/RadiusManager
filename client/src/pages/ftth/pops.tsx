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
import { PopDialog } from "@/components/ftth/pop-dialog";
import { PopDetailDialog } from "@/components/ftth/pop-detail-dialog";
import { useState } from "react";
import type { Pop } from "@shared/schema";

export default function PopsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingPop, setEditingPop] = useState<Pop | null>(null);
  const [viewingPop, setViewingPop] = useState<Pop | null>(null);

  const { data: pops, isLoading } = useQuery<Pop[]>({
    queryKey: ['/api/pops'],
  });

  const handleAdd = () => {
    setEditingPop(null);
    setDialogOpen(true);
  };

  const handleEdit = (pop: Pop) => {
    setEditingPop(pop);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingPop(null);
  };

  const handleViewDetails = (pop: Pop) => {
    setViewingPop(pop);
    setDetailDialogOpen(true);
  };

  const handleCloseDetailDialog = () => {
    setDetailDialogOpen(false);
    setViewingPop(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading POPs...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">POPs (Point of Presence)</h1>
          <p className="text-sm text-muted-foreground">
            Manage physical locations where your FTTH equipment is installed
          </p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-pop">
          <Plus className="h-4 w-4 mr-2" />
          Add POP
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Coordinates</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!pops || pops.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No POPs found. Add your first location to get started.
                </TableCell>
              </TableRow>
            ) : (
              pops.map((pop) => (
                <TableRow key={pop.id} data-testid={`row-pop-${pop.id}`}>
                  <TableCell className="font-medium">{pop.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{pop.code}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{pop.address || '-'}</TableCell>
                  <TableCell>
                    {pop.latitude && pop.longitude ? (
                      <span className="text-xs font-mono">
                        {parseFloat(pop.latitude).toFixed(5)}, {parseFloat(pop.longitude).toFixed(5)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pop.contactPerson ? (
                      <div className="text-sm">
                        <div>{pop.contactPerson}</div>
                        {pop.contactPhone && (
                          <div className="text-xs text-muted-foreground">{pop.contactPhone}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pop.isActive ? "default" : "secondary"}>
                      {pop.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(pop)}
                        data-testid={`button-view-pop-${pop.id}`}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Details
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(pop)}
                        data-testid={`button-edit-pop-${pop.id}`}
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

      <PopDialog
        open={dialogOpen}
        onOpenChange={handleCloseDialog}
        pop={editingPop}
      />
      
      <PopDetailDialog
        open={detailDialogOpen}
        onOpenChange={handleCloseDetailDialog}
        pop={viewingPop}
      />
    </div>
  );
}
