import { useGetDashboardSummary, useGetPortfolioOverview } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Activity, AlertTriangle, Battery, Clock, Zap, Target } from "lucide-react";

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: portfolio, isLoading: portfolioLoading } = useGetPortfolioOverview();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'bg-primary/20 text-primary border-primary/50';
      case 'draft': return 'bg-muted text-muted-foreground border-muted';
      case 'revised': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'not_started': return 'bg-destructive/20 text-destructive border-destructive/50';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Portfolio Command Centre
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Real-time monitoring across all active assets
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm text-muted-foreground">{format(new Date(), "yyyy-MM-dd HH:mm:ss z")}</p>
          <div className="flex items-center justify-end gap-2 mt-1">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs uppercase tracking-wider text-primary font-bold">Live Data</span>
          </div>
        </div>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-md" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <MetricCard title="Capacity" value={`${summary.totalCapacityMw} MW`} icon={Battery} sub={`${summary.totalPlants} Plants`} />
          <MetricCard title="Today's Forecast" value={`${summary.todayForecastMwh.toLocaleString()} MWh`} icon={Zap} />
          <MetricCard title="Accuracy" value={`${summary.forecastAccuracyPct}%`} icon={Target} sub="7-day MAPE" trend={summary.forecastAccuracyPct > 90 ? 'up' : 'down'} />
          <MetricCard title="Pending" value={summary.pendingSchedules.toString()} icon={Clock} sub="Schedules" alert={summary.pendingSchedules > 0} />
          <MetricCard title="Submitted" value={summary.submittedSchedules.toString()} icon={Activity} sub="Schedules today" />
          <MetricCard title="Alerts" value={summary.alertCount.toString()} icon={AlertTriangle} alert={summary.alertCount > 0} />
        </div>
      ) : null}

      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border pb-4 bg-muted/20">
          <CardTitle className="text-lg font-mono tracking-tight uppercase flex justify-between items-center">
            <span>Plant Status Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {portfolioLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : portfolio ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Plant</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider">State / SLDC</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider text-right">Capacity (MW)</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider text-right">Forecast (MWh)</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider text-right">Accuracy</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portfolio.map((plant) => (
                  <TableRow key={plant.plantId} className="border-border hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-foreground">{plant.plantName}</span>
                        <span className="text-xs text-muted-foreground font-mono">ID: {plant.plantId}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{plant.state}</span>
                        <span className="text-xs text-muted-foreground font-mono">{plant.sldc}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{plant.capacityMw.toFixed(1)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{plant.todayForecastMwh.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary">{plant.forecastAccuracyPct.toFixed(1)}%</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase border ${getStatusColor(plant.scheduleStatus)}`}>
                          {plant.scheduleStatus.replace('_', ' ')}
                        </Badge>
                        {plant.lastSubmittedAt && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {format(new Date(plant.lastSubmittedAt), "HH:mm")} (Rev {plant.revisionNumber})
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {portfolio.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground font-mono">
                      No plants found in portfolio.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-center text-destructive font-mono text-sm">Failed to load portfolio data.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, sub, alert, trend }: any) {
  return (
    <Card className={`border-border bg-card overflow-hidden ${alert ? 'border-destructive ring-1 ring-destructive/30' : ''}`}>
      <CardContent className="p-5 flex flex-col justify-between h-full relative">
        <div className="flex justify-between items-start mb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{title}</span>
          <Icon className={`h-4 w-4 ${alert ? 'text-destructive' : 'text-muted-foreground'}`} />
        </div>
        <div>
          <div className={`text-2xl font-bold font-mono tracking-tight ${alert ? 'text-destructive' : 'text-foreground'}`}>
            {value}
          </div>
          {sub && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
