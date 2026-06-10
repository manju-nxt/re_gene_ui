import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";

import Dashboard from "@/pages/Dashboard";
import DayAheadForecast from "@/pages/DayAheadForecast";
import IntraDayForecast from "@/pages/IntraDayForecast";
import Schedules from "@/pages/Schedules";
import CreateSchedule from "@/pages/CreateSchedule";
import ScheduleDetail from "@/pages/ScheduleDetail";
import AdminUpload from "@/pages/AdminUpload";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen overflow-hidden w-full bg-background text-foreground">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto w-full relative h-screen">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/forecast/day-ahead" component={DayAheadForecast} />
        <Route path="/forecast/intra-day" component={IntraDayForecast} />
        <Route path="/schedules" component={Schedules} />
        <Route path="/schedules/new" component={CreateSchedule} />
        <Route path="/schedules/:id" component={ScheduleDetail} />
        <Route path="/admin/upload" component={AdminUpload} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
