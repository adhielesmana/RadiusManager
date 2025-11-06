import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Server, Pencil, Trash2 } from "lucide-react";
import { RouterDialog } from "@/components/router-dialog";
import type { Nas } from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Routers() {
  const { toast } = useToast();
  const [selectedRouter, setSelectedRouter] = useState<Nas | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [routerToDelete, setRouterToDelete] = useState<Nas | null>(null);

  const { data: routers = [], isLoading } = useQuery<Nas[]>({
    queryKey: ['/api/nas'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/nas/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete router');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nas'] });
      toast({
        title: "Router deleted",
        description: "The router has been removed successfully",
      });
      setDeleteDialogOpen(false);
      setRouterToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddRouter = () => {
    setSelectedRouter(null);
    setIsDialogOpen(true);
  };

  const handleEditRouter = (router: Nas) => {
    setSelectedRouter(router);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (router: Nas) => {
    setRouterToDelete(router);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (routerToDelete) {
      deleteMutation.mutate(routerToDelete.id);
    }
  };

  const getRouterTypeColor = (type: string) => {
    const typeColors: Record<string, string> = {
      mikrotik: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      cisco: "bg-green-500/10 text-green-500 border-green-500/20",
      ubiquiti: "bg-purple-500/10 text-purple-500 border-purple-500/20",
      other: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    };
    return typeColors[type.toLowerCase()] || typeColors.other;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-routers">Routers (NAS)</h1>
          <p className="text-sm text-muted-foreground">
            Manage FreeRADIUS NAS devices and router configurations
          </p>
        </div>
        <Button onClick={handleAddRouter} data-testid="button-add-router">
          <Plus className="mr-2 h-4 w-4" /> Add Router
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="h-64 animate-pulse bg-muted rounded" />
          </CardContent>
        </Card>
      ) : routers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Server className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-base font-medium text-muted-foreground">No routers configured</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first router to connect it with FreeRADIUS
            </p>
            <Button onClick={handleAddRouter} className="mt-4" data-testid="button-add-router-empty">
              <Plus className="mr-2 h-4 w-4" /> Add Router
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configured Routers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NAS Name</TableHead>
                  <TableHead>Short Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routers.map((router) => (
                  <TableRow key={router.id} data-testid={`router-row-${router.id}`}>
                    <TableCell className="font-medium font-mono text-sm">
                      {router.nasname}
                    </TableCell>
                    <TableCell>
                      {router.shortname || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getRouterTypeColor(router.type)}>
                        {router.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {router.ports || <span className="text-muted-foreground">1812</span>}
                    </TableCell>
                    <TableCell>
                      {router.description || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditRouter(router)}
                          data-testid={`button-edit-router-${router.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteClick(router)}
                          data-testid={`button-delete-router-${router.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <RouterDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        router={selectedRouter}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Router</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete router "{routerToDelete?.nasname}"? This action
              cannot be undone and will disconnect the router from FreeRADIUS.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
