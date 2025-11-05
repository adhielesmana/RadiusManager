import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Settings } from "@shared/schema";
import { CURRENCIES } from "@shared/currencies";
import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [selectedCurrency, setSelectedCurrency] = useState<string>("IDR");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['/api/settings'],
  });

  useEffect(() => {
    if (settings?.currencyCode) {
      setSelectedCurrency(settings.currencyCode);
    }
    if (settings?.logoUrl) {
      setLogoUrl(settings.logoUrl);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { currencyCode?: string; logoUrl?: string }) => {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Settings updated",
        description: "Settings have been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCurrencySave = () => {
    updateSettingsMutation.mutate({ currencyCode: selectedCurrency });
  };

  const handleLogoSave = () => {
    updateSettingsMutation.mutate({ logoUrl });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file",
        description: "Please upload an image file (PNG, JPG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setLogoUrl(dataUrl);
      // Auto-save after upload
      updateSettingsMutation.mutate({ logoUrl: dataUrl });
    };
    reader.onerror = () => {
      toast({
        title: "Upload failed",
        description: "Failed to read the image file",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    updateSettingsMutation.mutate({ logoUrl: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-settings">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your ISP management system</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Branding</CardTitle>
          <CardDescription>Upload or provide a URL for your company logo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {!logoUrl ? (
                <div className="space-y-4">
                  <Label>Upload Logo</Label>
                  <div 
                    className="flex flex-col items-center justify-center rounded-md border-2 border-dashed border-border p-8 hover-elevate cursor-pointer transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="div-logo-upload-area"
                  >
                    <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                    <p className="text-sm font-medium mb-1">Click to upload logo</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG or GIF (max 2MB)</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-logo-file"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label>Current Logo</Label>
                  <div className="flex items-center gap-4 rounded-md border border-border p-4 bg-muted/30">
                    <div className="flex h-16 w-16 items-center justify-center rounded-md border border-border bg-background">
                      <img 
                        src={logoUrl} 
                        alt="Company logo" 
                        className="max-h-14 max-w-14 object-contain"
                        data-testid="img-logo-preview"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Logo uploaded</p>
                      <p className="text-xs text-muted-foreground">This logo appears in the sidebar and on invoices</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={handleRemoveLogo}
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-remove-logo"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={updateSettingsMutation.isPending}
                      data-testid="button-change-logo"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Change Logo
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-logo-file"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Update your company details for invoices and communications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input id="company-name" placeholder="Your ISP Company" data-testid="input-company-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-email">Email</Label>
              <Input id="company-email" type="email" placeholder="info@yourisp.com" data-testid="input-company-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-phone">Phone</Label>
              <Input id="company-phone" placeholder="+1 234 567 8900" data-testid="input-company-phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-tax">Tax ID</Label>
              <Input id="company-tax" placeholder="123-45-6789" data-testid="input-company-tax" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company-address">Address</Label>
              <Input id="company-address" placeholder="123 Main Street, City, State, ZIP" data-testid="input-company-address" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button data-testid="button-save-company">Save Changes</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>RADIUS Configuration</CardTitle>
          <CardDescription>Configure FreeRADIUS integration settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="radius-server">RADIUS Server</Label>
              <Input id="radius-server" placeholder="radius.yourisp.com" data-testid="input-radius-server" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="radius-port">Port</Label>
              <Input id="radius-port" placeholder="1812" data-testid="input-radius-port" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="radius-secret">Shared Secret</Label>
              <Input id="radius-secret" type="password" placeholder="••••••••" data-testid="input-radius-secret" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="radius-nas">NAS Identifier</Label>
              <Input id="radius-nas" placeholder="nas1" data-testid="input-radius-nas" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button data-testid="button-save-radius">Save Configuration</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Currency Settings</CardTitle>
          <CardDescription>Select your preferred currency for all financial transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select 
                  value={selectedCurrency} 
                  onValueChange={setSelectedCurrency}
                >
                  <SelectTrigger id="currency" data-testid="select-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem 
                        key={currency.code} 
                        value={currency.code}
                        data-testid={`currency-${currency.code}`}
                      >
                        {currency.symbol} - {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  This currency will be used for all invoices, profiles, and financial displays
                </p>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleCurrencySave}
                  disabled={updateSettingsMutation.isPending}
                  data-testid="button-save-currency"
                >
                  {updateSettingsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Currency
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
