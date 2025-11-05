import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-settings">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your ISP management system</p>
      </div>

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
          <CardTitle>Invoice Settings</CardTitle>
          <CardDescription>Configure invoice generation and billing preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-rate">Tax Rate (%)</Label>
              <Input id="tax-rate" type="number" placeholder="0" data-testid="input-tax-rate" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
              <Input id="invoice-prefix" placeholder="INV-" data-testid="input-invoice-prefix" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-terms">Payment Terms (days)</Label>
              <Input id="payment-terms" type="number" placeholder="30" data-testid="input-payment-terms" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" placeholder="USD" data-testid="input-currency" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button data-testid="button-save-invoice">Save Settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
