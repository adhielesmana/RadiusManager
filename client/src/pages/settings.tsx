import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Settings, CompanyGroup } from "@shared/schema";
import { CURRENCIES } from "@shared/currencies";
import { useState, useEffect, useRef } from "react";
import { Loader2, Upload, X, Plus, Pencil, CheckCircle2, XCircle, RefreshCw, Database, Wifi } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CompanyGroupDialog } from "@/components/company-group-dialog";

interface DatabaseStatus {
  connected: boolean;
  host?: string;
  database?: string;
  responseTime?: number;
  timestamp?: string;
  error?: string;
}

interface RadiusStatus {
  connected: boolean;
  host?: string;
  port?: number;
  secret?: string;
  type?: string;
  responseTime?: number;
  userCount?: number;
  timestamp?: string;
  error?: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [selectedCurrency, setSelectedCurrency] = useState<string>("IDR");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [companyGroupDialogOpen, setCompanyGroupDialogOpen] = useState(false);
  const [selectedCompanyGroup, setSelectedCompanyGroup] = useState<CompanyGroup | null>(null);
  const [savingRadius, setSavingRadius] = useState(false);
  const [resettingRadius, setResettingRadius] = useState(false);
  
  // Controlled form state for RADIUS configuration
  const [radiusHost, setRadiusHost] = useState<string>("");
  const [radiusSecret, setRadiusSecret] = useState<string>("");
  const [radiusAuthPort, setRadiusAuthPort] = useState<string>("");
  const [radiusAcctPort, setRadiusAcctPort] = useState<string>("");

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ['/api/settings'],
  });

  const { data: companyGroups = [], isLoading: groupsLoading } = useQuery<CompanyGroup[]>({
    queryKey: ['/api/company-groups'],
  });

  // Connection status queries
  const { data: dbStatus, isLoading: dbStatusLoading, refetch: refetchDbStatus } = useQuery<DatabaseStatus>({
    queryKey: ['/api/status/database'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: radiusStatus, isLoading: radiusStatusLoading, refetch: refetchRadiusStatus } = useQuery<RadiusStatus>({
    queryKey: ['/api/status/radius'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  useEffect(() => {
    if (settings?.currencyCode) {
      setSelectedCurrency(settings.currencyCode);
    }
    if (settings?.logoUrl) {
      setLogoUrl(settings.logoUrl);
    }
    // Initialize RADIUS form fields from database
    setRadiusHost(settings?.radiusHost || '');
    setRadiusSecret(settings?.radiusSecret || '');
    setRadiusAuthPort(settings?.radiusAuthPort?.toString() || '');
    setRadiusAcctPort(settings?.radiusAcctPort?.toString() || '');
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
      try {
        const dataUrl = event.target?.result;
        
        if (!dataUrl || typeof dataUrl !== 'string') {
          throw new Error('Invalid file data');
        }
        
        // Validate the data URL format
        if (!dataUrl.startsWith('data:image/')) {
          throw new Error('Invalid image format');
        }
        
        setLogoUrl(dataUrl);
        // Auto-save after upload
        updateSettingsMutation.mutate({ logoUrl: dataUrl });
      } catch (error: any) {
        console.error('Logo upload error:', error);
        toast({
          title: "Upload failed",
          description: error.message || "Failed to process the image file",
          variant: "destructive",
        });
      }
    };
    
    reader.onerror = (event) => {
      const errorMsg = reader.error?.message || 'Unknown error';
      console.error('FileReader error:', reader.error, event);
      toast({
        title: "Upload failed",
        description: `Failed to read the image file: ${errorMsg}`,
        variant: "destructive",
      });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    
    reader.onabort = () => {
      console.warn('File reading was aborted');
      toast({
        title: "Upload cancelled",
        description: "File reading was cancelled",
        variant: "destructive",
      });
    };
    
    try {
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Failed to start reading file:', error);
      toast({
        title: "Upload failed",
        description: "Could not start reading the file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    updateSettingsMutation.mutate({ logoUrl: "" });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSaveRadiusConfig = async () => {
    try {
      setSavingRadius(true);
      
      // Trim and normalize values
      const trimmedHost = radiusHost.trim();
      const trimmedSecret = radiusSecret.trim();
      const trimmedAuthPort = radiusAuthPort.trim();
      const trimmedAcctPort = radiusAcctPort.trim();
      
      // Check if any field has a non-empty value
      const hasAnyValue = trimmedHost !== '' || trimmedSecret !== '' || trimmedAuthPort !== '' || trimmedAcctPort !== '';
      
      if (hasAnyValue) {
        // If any value is provided, validate that ALL required fields are present
        if (!trimmedHost || !trimmedSecret || !trimmedAuthPort || !trimmedAcctPort) {
          toast({
            title: "Validation Error",
            description: "All RADIUS fields (host, secret, auth port, accounting port) must be provided together",
            variant: "destructive",
          });
          setSavingRadius(false);
          return;
        }
        
        // Validate port numbers
        const authPortNum = parseInt(trimmedAuthPort, 10);
        const acctPortNum = parseInt(trimmedAcctPort, 10);
        
        if (isNaN(authPortNum) || authPortNum <= 0 || authPortNum > 65535) {
          toast({
            title: "Validation Error",
            description: "Auth port must be a number between 1 and 65535",
            variant: "destructive",
          });
          setSavingRadius(false);
          return;
        }
        
        if (isNaN(acctPortNum) || acctPortNum <= 0 || acctPortNum > 65535) {
          toast({
            title: "Validation Error",
            description: "Accounting port must be a number between 1 and 65535",
            variant: "destructive",
          });
          setSavingRadius(false);
          return;
        }
        
        // Send trimmed values as strings for host/secret, numbers for ports
        await apiRequest('PATCH', '/api/settings/radius', {
          radiusHost: trimmedHost,
          radiusSecret: trimmedSecret,
          radiusAuthPort: authPortNum,
          radiusAcctPort: acctPortNum,
        });
      } else {
        // All fields are empty, send nulls to reset
        await apiRequest('PATCH', '/api/settings/radius', {
          radiusHost: null,
          radiusSecret: null,
          radiusAuthPort: null,
          radiusAcctPort: null,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/status/radius'] });
      refetchRadiusStatus();

      toast({
        title: "RADIUS configuration saved",
        description: "RADIUS server settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save RADIUS configuration",
        variant: "destructive",
      });
    } finally {
      setSavingRadius(false);
    }
  };

  const handleResetRadiusConfig = async () => {
    try {
      setResettingRadius(true);

      await apiRequest('POST', '/api/settings/radius/reset');

      // Clear form state
      setRadiusHost('');
      setRadiusSecret('');
      setRadiusAuthPort('');
      setRadiusAcctPort('');

      await queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/status/radius'] });
      refetchRadiusStatus();

      toast({
        title: "RADIUS configuration reset",
        description: "RADIUS server settings have been reset to defaults (local container).",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset RADIUS configuration",
        variant: "destructive",
      });
    } finally {
      setResettingRadius(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-settings">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-settings">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your ISP management system</p>
      </div>

      {/* Connection Status Section */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Database Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database Connection
            </CardTitle>
            <CardDescription>PostgreSQL database status</CardDescription>
          </CardHeader>
          <CardContent>
            {dbStatusLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Checking connection...</span>
              </div>
            ) : dbStatus?.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" data-testid="icon-db-connected" />
                  <span className="font-medium text-green-600">Connected</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Host:</span>
                    <span className="font-mono" data-testid="text-db-host">{dbStatus.host}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Database:</span>
                    <span className="font-mono" data-testid="text-db-name">{dbStatus.database}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response Time:</span>
                    <span className="font-mono" data-testid="text-db-response">{dbStatus.responseTime}ms</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchDbStatus()}
                  className="w-full"
                  data-testid="button-refresh-db-status"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Refresh Status
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" data-testid="icon-db-disconnected" />
                  <span className="font-medium text-red-600">Disconnected</span>
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-db-error">
                  {dbStatus?.error || 'Unable to connect to database'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchDbStatus()}
                  className="w-full"
                  data-testid="button-retry-db-connection"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Retry Connection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* FreeRADIUS Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              FreeRADIUS Connection
            </CardTitle>
            <CardDescription>RADIUS server status</CardDescription>
          </CardHeader>
          <CardContent>
            {radiusStatusLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Checking connection...</span>
              </div>
            ) : radiusStatus?.connected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" data-testid="icon-radius-connected" />
                  <span className="font-medium text-green-600">Connected</span>
                  <Badge variant="outline" className="ml-auto" data-testid="badge-radius-type">
                    {radiusStatus.type}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Host:</span>
                    <span className="font-mono" data-testid="text-radius-host">{radiusStatus.host}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Port:</span>
                    <span className="font-mono" data-testid="text-radius-port">{radiusStatus.port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Secret:</span>
                    <span className="font-mono" data-testid="text-radius-secret">{radiusStatus.secret}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RADIUS Users:</span>
                    <span className="font-mono" data-testid="text-radius-users">{radiusStatus.userCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Response Time:</span>
                    <span className="font-mono" data-testid="text-radius-response">{radiusStatus.responseTime}ms</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchRadiusStatus()}
                  className="w-full"
                  data-testid="button-refresh-radius-status"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Refresh Status
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" data-testid="icon-radius-disconnected" />
                  <span className="font-medium text-red-600">Disconnected</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Host:</span>
                    <span className="font-mono" data-testid="text-radius-host-error">{radiusStatus?.host || 'Unknown'}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground" data-testid="text-radius-error">
                  {radiusStatus?.error || 'Unable to connect to RADIUS server'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchRadiusStatus()}
                  className="w-full"
                  data-testid="button-retry-radius-connection"
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Retry Connection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RADIUS Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            FreeRADIUS Configuration
          </CardTitle>
          <CardDescription>
            Configure RADIUS server connection. Leave fields empty to use local container defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="radius-host">RADIUS Host</Label>
              <Input
                id="radius-host"
                placeholder="freeradius (default)"
                value={radiusHost}
                onChange={(e) => setRadiusHost(e.target.value)}
                data-testid="input-radius-host"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for local container (freeradius)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="radius-secret">RADIUS Secret</Label>
              <Input
                id="radius-secret"
                type="password"
                placeholder="testing123 (default)"
                value={radiusSecret}
                onChange={(e) => setRadiusSecret(e.target.value)}
                data-testid="input-radius-secret"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for default (testing123)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="radius-auth-port">Auth Port</Label>
              <Input
                id="radius-auth-port"
                type="number"
                placeholder="1812 (default)"
                value={radiusAuthPort}
                onChange={(e) => setRadiusAuthPort(e.target.value)}
                data-testid="input-radius-auth-port"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for default (1812)
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="radius-acct-port">Accounting Port</Label>
              <Input
                id="radius-acct-port"
                type="number"
                placeholder="1813 (default)"
                value={radiusAcctPort}
                onChange={(e) => setRadiusAcctPort(e.target.value)}
                data-testid="input-radius-acct-port"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for default (1813)
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => handleSaveRadiusConfig()}
              disabled={savingRadius}
              data-testid="button-save-radius-config"
            >
              {savingRadius ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleResetRadiusConfig()}
              disabled={resettingRadius}
              data-testid="button-reset-radius-config"
            >
              {resettingRadius ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset to Defaults'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <div>
            <CardTitle>Company Groups</CardTitle>
            <CardDescription>Manage company groups for subscription ID generation (YYMMDDXNNNN)</CardDescription>
          </div>
          <Button 
            onClick={() => {
              setSelectedCompanyGroup(null);
              setCompanyGroupDialogOpen(true);
            }}
            data-testid="button-add-company-group"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Group
          </Button>
        </CardHeader>
        <CardContent>
          {groupsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : companyGroups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No company groups yet. Add your first group to organize subscriptions.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyGroups.map((group) => (
                    <TableRow key={group.id} data-testid={`row-company-group-${group.id}`}>
                      <TableCell className="font-mono font-semibold" data-testid={`text-code-${group.id}`}>
                        {group.code}
                      </TableCell>
                      <TableCell data-testid={`text-name-${group.id}`}>
                        {group.name}
                      </TableCell>
                      <TableCell className="max-w-md text-sm text-muted-foreground" data-testid={`text-description-${group.id}`}>
                        {group.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={group.isActive ? "default" : "secondary"} data-testid={`status-${group.id}`}>
                          {group.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedCompanyGroup(group);
                            setCompanyGroupDialogOpen(true);
                          }}
                          data-testid={`button-edit-group-${group.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CompanyGroupDialog
        open={companyGroupDialogOpen}
        onOpenChange={setCompanyGroupDialogOpen}
        companyGroup={selectedCompanyGroup}
      />
    </div>
  );
}
