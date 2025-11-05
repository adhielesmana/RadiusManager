import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  type: 'customer' | 'payment' | 'ticket' | 'priority';
}

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const getVariantClasses = () => {
    const normalizedStatus = status.toLowerCase().replace(/[_\s]/g, '');
    
    if (type === 'customer') {
      switch (normalizedStatus) {
        case 'active':
          return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
        case 'suspended':
          return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
        case 'expired':
          return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
        default:
          return 'bg-muted text-muted-foreground border-muted-border';
      }
    }
    
    if (type === 'payment') {
      switch (normalizedStatus) {
        case 'paid':
          return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
        case 'pending':
          return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
        case 'overdue':
          return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
        default:
          return 'bg-muted text-muted-foreground border-muted-border';
      }
    }
    
    if (type === 'ticket') {
      switch (normalizedStatus) {
        case 'open':
          return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800';
        case 'inprogress':
          return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800';
        case 'resolved':
          return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800';
        case 'closed':
          return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800';
        default:
          return 'bg-muted text-muted-foreground border-muted-border';
      }
    }
    
    if (type === 'priority') {
      switch (normalizedStatus) {
        case 'urgent':
          return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
        case 'high':
          return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
        case 'medium':
          return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
        case 'low':
          return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800';
        default:
          return 'bg-muted text-muted-foreground border-muted-border';
      }
    }
    
    return 'bg-muted text-muted-foreground border-muted-border';
  };

  const formatLabel = () => {
    return status
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Badge 
      variant="outline" 
      className={cn("px-2.5 py-0.5 text-xs font-medium rounded-full border", getVariantClasses())}
      data-testid={`badge-${type}-${status.toLowerCase()}`}
    >
      {formatLabel()}
    </Badge>
  );
}
