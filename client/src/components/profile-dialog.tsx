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
import { insertProfileSchema, type Profile, type InsertProfile } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile | null;
}

export function ProfileDialog({ open, onOpenChange, profile }: ProfileDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InsertProfile>({
    resolver: zodResolver(insertProfileSchema),
    defaultValues: {
      name: "",
      downloadSpeed: 0,
      uploadSpeed: 0,
      dataQuota: undefined,
      fupThreshold: undefined,
      fupSpeed: undefined,
      validityDays: 30,
      price: "0",
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        name: profile.name,
        downloadSpeed: profile.downloadSpeed,
        uploadSpeed: profile.uploadSpeed,
        dataQuota: profile.dataQuota || undefined,
        fupThreshold: profile.fupThreshold || undefined,
        fupSpeed: profile.fupSpeed || undefined,
        validityDays: profile.validityDays,
        price: profile.price.toString(),
        description: profile.description || "",
        isActive: profile.isActive,
      });
    } else {
      form.reset({
        name: "",
        downloadSpeed: 0,
        uploadSpeed: 0,
        dataQuota: undefined,
        fupThreshold: undefined,
        fupSpeed: undefined,
        validityDays: 30,
        price: "0",
        description: "",
        isActive: true,
      });
    }
  }, [profile, form]);

  const createMutation = useMutation({
    mutationFn: (data: InsertProfile) => apiRequest("POST", "/api/profiles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      toast({
        title: "Success",
        description: "Profile created successfully",
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
    mutationFn: (data: InsertProfile) => apiRequest("PATCH", `/api/profiles/${profile?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/profiles'] });
      toast({
        title: "Success",
        description: "Profile updated successfully",
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

  const onSubmit = (data: InsertProfile) => {
    if (profile) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? "Edit Profile" : "Add New Profile"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Profile Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Basic Plan 10Mbps" data-testid="input-profile-name" />
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
                      <Textarea {...field} placeholder="Description of the service profile" className="min-h-20" data-testid="input-profile-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-semibold">Speed Configuration</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="downloadSpeed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Download Speed (Mbps) *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="10"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-download-speed"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uploadSpeed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Upload Speed (Mbps) *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="5"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-upload-speed"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-semibold">Data Quota & FUP</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dataQuota"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Quota (GB)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="100"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-data-quota"
                        />
                      </FormControl>
                      <FormDescription>Leave empty for unlimited</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fupThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FUP Threshold (%)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="80"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-fup-threshold"
                        />
                      </FormControl>
                      <FormDescription>When to apply FUP</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fupSpeed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FUP Speed (Mbps)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="2"
                          value={field.value || ''}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-fup-speed"
                        />
                      </FormControl>
                      <FormDescription>Speed after FUP threshold</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-base font-semibold">Pricing & Validity</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="validityDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validity Period (Days) *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          placeholder="30"
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          data-testid="input-validity-days"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price ($) *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          step="0.01"
                          placeholder="29.99"
                          data-testid="input-price"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-profile">
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : profile ? "Update Profile" : "Add Profile"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
