import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Subscriptions from "@/pages/subscriptions";
import Profiles from "@/pages/profiles";
import Invoices from "@/pages/invoices";
import Tickets from "@/pages/tickets";
import Settings from "@/pages/settings";
import Users from "@/pages/users";
import Routers from "@/pages/routers";
import PopsPage from "@/pages/ftth/pops";
import OltsPage from "@/pages/ftth/olts";
import DistributionBoxesPage from "@/pages/ftth/distribution-boxes";
import LoginPage from "@/pages/login";
import NotFound from "@/pages/not-found";
import { LogOut, User as UserIcon } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/customers" component={Customers} />
      <Route path="/subscriptions" component={Subscriptions} />
      <Route path="/profiles" component={Profiles} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/tickets" component={Tickets} />
      <Route path="/routers" component={Routers} />
      <Route path="/users" component={Users} />
      <Route path="/settings" component={Settings} />
      <Route path="/ftth/pops" component={PopsPage} />
      <Route path="/ftth/olts" component={OltsPage} />
      <Route path="/ftth/distribution-boxes" component={DistributionBoxesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, logout, isLoading, login } = useAuth();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={login} />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{user.fullName}</span>
                <span className="text-muted-foreground">({user.role})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-background">
            <div className="max-w-7xl mx-auto px-6 py-8">
              <Router />
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
