import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { insertNasSchema, type Nas, type InsertNas } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface RouterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  router: Nas | null;
}

export function RouterDialog({ open, onOpenChange, router }: RouterDialogProps) {
  const { toast } = useToast();
  const isEditing = !!router;

  const form = useForm<InsertNas>({
    resolver: zodResolver(insertNasSchema),
    defaultValues: {
      nasname: "",
      shortname: "",
      type: "other",
      ports: 1812,
      secret: "",
      server: "",
      community: "",
      description: "RADIUS Client",
    },
  });

  useEffect(() => {
    if (router) {
      form.reset({
        nasname: router.nasname,
        shortname: router.shortname || "",
        type: router.type,
        ports: router.ports || 1812,
        secret: router.secret,
        server: router.server || "",
        community: router.community || "",
        description: router.description || "RADIUS Client",
      });
    } else {
      form.reset({
        nasname: "",
        shortname: "",
        type: "other",
        ports: 1812,
        secret: "",
        server: "",
        community: "",
        description: "RADIUS Client",
      });
    }
  }, [router, form]);

  const mutation = useMutation({
    mutationFn: async (data: InsertNas) => {
      if (isEditing) {
        return await apiRequest(`/api/nas/${router.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        return await apiRequest('/api/nas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nas'] });
      toast({
        title: isEditing ? "Router updated" : "Router added",
        description: isEditing
          ? "The router has been updated successfully"
          : "The router has been added successfully",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertNas) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">
            {isEditing ? "Edit Router" : "Add New Router"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the router (NAS device) configuration for FreeRADIUS"
              : "Add a new router (NAS device) to connect with FreeRADIUS"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nasname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NAS Name (IP Address/Hostname) *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="192.168.1.1 or router.example.com"
                      data-testid="input-nasname"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The IP address or hostname of your router
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="shortname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="mikrotik-main"
                        data-testid="input-shortname"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Short identifier for this router
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Router Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mikrotik">MikroTik</SelectItem>
                        <SelectItem value="cisco">Cisco</SelectItem>
                        <SelectItem value="ubiquiti">Ubiquiti</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Type of router/NAS device
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="ports"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RADIUS Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="1812"
                        data-testid="input-ports"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>
                      RADIUS authentication port (default: 1812)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RADIUS Secret *</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Enter shared secret"
                        data-testid="input-secret"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Shared secret for RADIUS communication
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Main MikroTik Router"
                      data-testid="input-description"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Description to identify this router
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save"
              >
                {mutation.isPending
                  ? isEditing
                    ? "Updating..."
                    : "Adding..."
                  : isEditing
                  ? "Update Router"
                  : "Add Router"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
