import { Link, useLocation } from "wouter";
import { useHealthCheck, useListPlants } from "@workspace/api-client-react";
import { LayoutDashboard, LineChart, Activity, CalendarDays, ActivitySquare, AlertCircle } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const [location] = useLocation();
  const { data: health, isLoading: isHealthLoading, isError: isHealthError } = useHealthCheck();
  const { data: plants } = useListPlants();

  const navigation = [
    { title: "Portfolio Command Centre", icon: LayoutDashboard, url: "/" },
    { title: "Day-Ahead Forecast", icon: LineChart, url: "/forecast/day-ahead" },
    { title: "Intra-Day Forecast", icon: Activity, url: "/forecast/intra-day" },
    { title: "Schedule Management", icon: CalendarDays, url: "/schedules" },
  ];

  return (
    <Sidebar variant="sidebar" className="border-r border-sidebar-border bg-sidebar h-screen">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50">
        <div className="flex items-center gap-2 px-2">
          <ActivitySquare className="h-6 w-6 text-primary" />
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-sidebar-foreground">GREENH2 NXT</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">Revenue Intelligence</span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider font-mono text-muted-foreground mt-4 mb-2">Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.url} className={`flex items-center gap-3 w-full rounded-none ${isActive ? 'text-primary' : 'text-sidebar-foreground hover:text-primary'}`}>
                        <item.icon className="h-4 w-4" />
                        <span className="font-medium">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-4">
        <div className="flex flex-col gap-2 font-mono text-xs">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>PLANTS ONLINE</span>
            <span className="text-sidebar-foreground">{plants?.length ?? '-'}</span>
          </div>
          <div className="flex justify-between items-center text-muted-foreground">
            <span>SYSTEM STATUS</span>
            <div className="flex items-center gap-2">
              {isHealthLoading ? (
                <span className="text-muted-foreground">CHECKING</span>
              ) : isHealthError ? (
                <>
                  <AlertCircle className="h-3 w-3 text-destructive" />
                  <span className="text-destructive">DEGRADED</span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-primary uppercase">{health?.status || 'OPTIMAL'}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
