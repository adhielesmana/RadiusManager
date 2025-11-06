import { Home, Users, Gauge, FileText, Ticket, Settings, Network, Shield, Server, MapPin, Radio, Box, Wifi } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { Settings as SettingsType } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    roles: ["superadmin", "admin", "user"],
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Users,
    roles: ["superadmin", "admin", "user"],
  },
  {
    title: "Subscriptions",
    url: "/subscriptions",
    icon: Network,
    roles: ["superadmin", "admin", "user"],
  },
  {
    title: "Profiles",
    url: "/profiles",
    icon: Gauge,
    roles: ["superadmin", "admin", "user"],
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: FileText,
    roles: ["superadmin", "admin", "user"],
  },
  {
    title: "Tickets",
    url: "/tickets",
    icon: Ticket,
    roles: ["superadmin", "admin", "user"],
  },
  {
    title: "Routers",
    url: "/routers",
    icon: Server,
    roles: ["superadmin", "admin"],
  },
  {
    title: "Users",
    url: "/users",
    icon: Shield,
    roles: ["superadmin"], // Only superadmin can access
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    roles: ["superadmin", "admin"],
  },
];

const ftthMenuItems = [
  {
    title: "POPs",
    url: "/ftth/pops",
    icon: MapPin,
    roles: ["superadmin", "admin"],
  },
  {
    title: "OLTs",
    url: "/ftth/olts",
    icon: Radio,
    roles: ["superadmin", "admin"],
  },
  {
    title: "Distribution Boxes",
    url: "/ftth/distribution-boxes",
    icon: Box,
    roles: ["superadmin", "admin"],
  },
  {
    title: "ONUs",
    url: "/ftth/onus",
    icon: Wifi,
    roles: ["superadmin", "admin"],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: settings } = useQuery<SettingsType>({
    queryKey: ['/api/settings'],
  });

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  const visibleFtthMenuItems = ftthMenuItems.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          {settings?.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Company logo" 
              className="h-10 w-auto max-w-[180px] object-contain"
              data-testid="img-sidebar-logo"
            />
          ) : (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <Gauge className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-sidebar-foreground">ISP Manager</h1>
                <p className="text-xs text-muted-foreground">Network Control</p>
              </div>
            </>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleFtthMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>FTTH Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleFtthMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
