import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Eye, X, Search, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type SortField = 'ponSerial' | 'oltName' | 'odcNumber' | 'status' | 'signalRx' | 'signalTx';
type SortDirection = 'asc' | 'desc';

export default function OnusPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editingOnu, setEditingOnu] = useState<Onu | null>(null);
  const [viewingOnu, setViewingOnu] = useState<Onu | null>(null);
  const [deletingOnu, setDeletingOnu] = useState<Onu | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>('ponSerial');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
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

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Filter, search, sort, and paginate ONUs
  const { filteredOnus, totalPages, startIndex, endIndex } = useMemo(() => {
    if (!onus) return { filteredOnus: [], totalPages: 0, startIndex: 0, endIndex: 0 };
    
    // First filter by OLT if needed
    let filtered = filterOltId !== null ? onus.filter(onu => onu.oltId === filterOltId) : onus;
    
    // Then apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(onu => {
        const oltName = getOltName(onu.oltId).toLowerCase();
        const boxInfo = getBoxInfo(onu.distributionBoxId);
        const customerInfo = getCustomerInfo(onu.subscriptionId);
        
        return (
          onu.ponSerial.toLowerCase().includes(search) ||
          oltName.includes(search) ||
          boxInfo.code.toLowerCase().includes(search) ||
          boxInfo.name.toLowerCase().includes(search) ||
          (customerInfo?.name.toLowerCase().includes(search)) ||
          (customerInfo?.subscriptionId.toLowerCase().includes(search)) ||
          onu.status.toLowerCase().includes(search) ||
          ((onu as any).odcNumber?.toString().includes(search))
        );
      });
    }
    
    // Then sort
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;
      
      switch (sortField) {
        case 'ponSerial':
          aVal = a.ponSerial;
          bVal = b.ponSerial;
          break;
        case 'oltName':
          aVal = getOltName(a.oltId);
          bVal = getOltName(b.oltId);
          break;
        case 'odcNumber':
          aVal = (a as any).odcNumber || 0;
          bVal = (b as any).odcNumber || 0;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'signalRx':
          aVal = a.signalRx || -999;
          bVal = b.signalRx || -999;
          break;
        case 'signalTx':
          aVal = a.signalTx || -999;
          bVal = b.signalTx || -999;
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(filtered.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, filtered.length);
    const paginated = filtered.slice(startIndex, endIndex);
    
    return { filteredOnus: paginated, totalPages, startIndex, endIndex };
  }, [onus, filterOltId, searchTerm, sortField, sortDirection, currentPage, rowsPerPage, olts, distributionBoxes, subscriptions, customers]);

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

      <div className="px-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by PON serial, OLT, customer, status..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className="pl-9"
            data-testid="input-search-onus"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page:</span>
          <Select value={rowsPerPage.toString()} onValueChange={(val) => {
            setRowsPerPage(parseInt(val));
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-20" data-testid="select-rows-per-page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent" onClick={() => handleSort('ponSerial')}>
                PON Serial
                <ArrowUpDown className="ml-1 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent" onClick={() => handleSort('oltName')}>
                OLT
                <ArrowUpDown className="ml-1 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent" onClick={() => handleSort('odcNumber')}>
                ODC
                <ArrowUpDown className="ml-1 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead className="whitespace-nowrap">ONU ID</TableHead>
            <TableHead className="whitespace-nowrap">ODP</TableHead>
            <TableHead className="whitespace-nowrap">Customer</TableHead>
            <TableHead className="whitespace-nowrap">
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent" onClick={() => handleSort('signalRx')}>
                RX
                <ArrowUpDown className="ml-1 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent" onClick={() => handleSort('signalTx')}>
                TX
                <ArrowUpDown className="ml-1 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent" onClick={() => handleSort('status')}>
                Status
                <ArrowUpDown className="ml-1 h-3 w-3" />
              </Button>
            </TableHead>
            <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
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

      <div className="px-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {onus && onus.length > 0 ? startIndex + 1 : 0} to {endIndex} of {onus?.length || 0} total ONUs
          {searchTerm && <span className="ml-1">(filtered)</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            data-testid="button-first-page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">Page {currentPage}</span>
            <span className="text-sm text-muted-foreground">of {totalPages || 1}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
            data-testid="button-next-page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
            data-testid="button-last-page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
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
