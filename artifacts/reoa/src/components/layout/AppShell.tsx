import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Building2, 
  Users, 
  LayoutDashboard, 
  CheckSquare, 
  CalendarDays, 
  Zap, 
  Settings, 
  Bell, 
  FileText,
  Activity,
  UserCircle
} from "lucide-react";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem, 
  SidebarProvider, 
  SidebarTrigger 
} from "@/components/ui/sidebar";
import { useListNotifications } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [location] = useLocation();
  const { data: notifications } = useListNotifications({ read: false });
  const unreadCount = notifications?.length || 0;

  const navItems = [
    { title: "Dashboard", href: "/", icon: LayoutDashboard },
    { title: "Leads", href: "/leads", icon: UserCircle },
    { title: "Properties", href: "/properties", icon: Building2 },
    { title: "Clients", href: "/clients", icon: Users },
    { title: "Tasks", href: "/tasks", icon: CheckSquare },
    { title: "Calendar", href: "/calendar", icon: CalendarDays },
  ];

  const automationItems = [
    { title: "Workflows", href: "/workflows", icon: Zap },
    { title: "Executions", href: "/workflow-executions", icon: Activity },
  ];

  const sysItems = [
    { title: "Reports", href: "/reports", icon: FileText },
    { title: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/20">
        <Sidebar className="border-r border-border">
          <SidebarContent>
            <div className="p-4 py-6">
              <div className="flex items-center gap-2 px-2 text-primary font-display font-semibold text-lg tracking-tight">
                <Building2 className="h-6 w-6 text-accent" />
                <span>REOA</span>
              </div>
            </div>

            <SidebarGroup>
              <SidebarGroupLabel>Core</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location === item.href || (item.href !== "/" && location.startsWith(item.href))}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Automation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {automationItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location.startsWith(item.href)}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {sysItems.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={location.startsWith(item.href)}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card">
            <SidebarTrigger />
            <div className="flex items-center gap-4">
              <Link href="/notifications" className="relative p-2 text-muted-foreground hover:text-foreground transition-colors hover-elevate rounded-md">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive border border-card" />
                )}
              </Link>
              <div className="h-8 w-8 rounded-full bg-accent/20 border border-accent flex items-center justify-center text-accent font-medium text-sm font-display shadow-sm">
                A
              </div>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
