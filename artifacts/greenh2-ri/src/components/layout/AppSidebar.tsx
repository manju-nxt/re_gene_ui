import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useHealthCheck, useListPlants } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  LineChart,
  Activity,
  CalendarDays,
  ActivitySquare,
  AlertCircle,
  ChevronRight,
  Upload,
} from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const scheduleSubNav = [
  { title: "Day-Ahead Forecast", icon: LineChart, url: "/forecast/day-ahead" },
  { title: "Intra-Day Forecast", icon: Activity, url: "/forecast/intra-day" },
  { title: "Schedules", icon: CalendarDays, url: "/schedules" },
  { title: "Admin: Input Upload", icon: Upload, url: "/admin/upload" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { data: health, isLoading: isHealthLoading, isError: isHealthError } = useHealthCheck();
  const { data: plants } = useListPlants();

  const isScheduleSection = scheduleSubNav.some(
    (item) => location === item.url || location.startsWith(item.url),
  );
  const [scheduleOpen, setScheduleOpen] = useState<boolean>(true);

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
              {/* Portfolio Command Centre */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={location === "/"} tooltip="Portfolio Command Centre">
                  <Link
                    href="/"
                    className={`flex items-center gap-3 w-full rounded-none ${location === "/" ? "text-primary" : "text-sidebar-foreground hover:text-primary"}`}
                    data-testid="nav-portfolio"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span className="font-medium">Portfolio Command Centre</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Schedule Management — collapsible group */}
              <SidebarMenuItem>
                <Collapsible open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isScheduleSection}
                      className={`flex items-center gap-3 w-full rounded-none cursor-pointer ${isScheduleSection ? "text-primary" : "text-sidebar-foreground hover:text-primary"}`}
                      data-testid="nav-schedule-management"
                    >
                      <CalendarDays className="h-4 w-4" />
                      <span className="font-medium flex-1">Schedule Management</span>
                      <ChevronRight
                        className={`h-3 w-3 transition-transform duration-200 ${scheduleOpen ? "rotate-90" : ""}`}
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="mt-1 ml-2 border-l border-sidebar-border/40 pl-3 space-y-0.5">
                      {scheduleSubNav.map((item) => {
                        const isActive =
                          location === item.url ||
                          (item.url !== "/" && location.startsWith(item.url));
                        return (
                          <div key={item.title}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              tooltip={item.title}
                              size="sm"
                            >
                              <Link
                                href={item.url}
                                className={`flex items-center gap-2.5 w-full rounded-none py-1.5 ${isActive ? "text-primary" : "text-sidebar-foreground/80 hover:text-primary"}`}
                                data-testid={`nav-${item.url.replace(/\//g, "-").replace(/^-/, "")}`}
                              >
                                <item.icon className="h-3.5 w-3.5" />
                                <span className="text-xs font-medium">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-4">
        <div className="flex flex-col gap-2 font-mono text-xs">
          <div className="flex justify-between items-center text-muted-foreground">
            <span>PLANTS ONLINE</span>
            <span className="text-sidebar-foreground">{plants?.length ?? "-"}</span>
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
                  <span className="text-primary uppercase">{health?.status || "OPTIMAL"}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
