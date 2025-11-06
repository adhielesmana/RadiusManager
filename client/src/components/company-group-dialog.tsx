import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { insertCompanyGroupSchema, type CompanyGroup, type InsertCompanyGroup } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CompanyGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyGroup: CompanyGroup | null;
}

export function CompanyGroupDialog({ open, onOpenChange, companyGroup }: CompanyGroupDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertCompanyGroup>({
    resolver: zodResolver(insertCompanyGroupSchema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (companyGroup) {
      form.reset({
        code: companyGroup.code,
        name: companyGroup.name,
        description: companyGroup.description ?? "",
        isActive: companyGroup.isActive,
      });
    } else {
      form.reset({
        code: "",
        name: "",
        description: "",
        isActive: true,
      });
    }
  }, [companyGroup, form]);

  const createMutation = useMutation({
    mutationFn: (data: InsertCompanyGroup) => apiRequest("POST", "/api/company-groups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-groups'] });
      toast({
        title: "Success",
        description: "Company group created successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertCompanyGroup) => apiRequest("PATCH", `/api/company-groups/${companyGroup?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-groups'] });
      toast({
        title: "Success",
        description: "Company group updated successfully",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertCompanyGroup) => {
    if (companyGroup) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{companyGroup ? "Edit Company Group" : "Add New Company Group"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Code *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="1" maxLength={1} className="font-mono" data-testid="input-code" />
                  </FormControl>
                  <FormDescription>
                    Single digit (0-9) used in subscription IDs: YYMMDD<strong>{field.value || "X"}</strong>NNNN
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Main Group" data-testid="input-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="Optional description for this group" className="min-h-20" data-testid="input-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Status</FormLabel>
                    <FormDescription>
                      Inactive groups cannot be assigned to new subscriptions
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-active"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-company-group">
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : companyGroup ? "Update Group" : "Add Group"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
