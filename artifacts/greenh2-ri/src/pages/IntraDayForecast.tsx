import { useState } from "react";
import { format } from "date-fns";
import { useGetIntraDayForecast, useListPlants, useListForecasts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Activity, Clock } from "lucide-react";

export default function IntraDayForecast() {
  const today = format(new Date(), "yyyy-MM-dd");
  const currentTime = format(new Date(), "HH:mm");
  
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [date, setDate] = useState<string>(today);

  const { data: plants, isLoading: plantsLoading } = useListPlants();
  
  const plantIdNum = selectedPlantId ? parseInt(selectedPlantId) : 0;

  const { data: forecast, isLoading: forecastLoading } = useGetIntraDayForecast(
    { plantId: plantIdNum, date },
    { query: { enabled: !!plantIdNum, queryKey: ["/api/forecasts/intra-day", { plantId: plantIdNum, date }] } }
  );

  const { data: runs } = useListForecasts(
    { plantId: plantIdNum, type: "intra_day", date },
    { query: { enabled: !!plantIdNum, queryKey: ["/api/forecasts", { plantId: plantIdNum, type: "intra_day", date }] } }
  );

  const chartData = forecast?.slots.map(s => ({
    time: format(new Date(s.slotStart), "HH:mm"),
    forecast: s.forecastMw,
    lower: s.lowerBoundMw,
    upper: s.upperBoundMw,
    isPast: new Date(s.slotStart) < new Date()
  })) || [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Activity className="h-8 w-8 text-[#00E5FF]" />
            Intra-Day Forecast
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Real-time block revisions & corrections
          </p>
        </div>

        <div className="flex gap-4 items-end bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="space-y-1">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Select Plant</Label>
            <Select value={selectedPlantId} onValueChange={setSelectedPlantId} disabled={plantsLoading}>
              <SelectTrigger className="w-[240px] font-mono text-sm border-border bg-background">
                <SelectValue placeholder="Select a plant..." />
              </SelectTrigger>
              <SelectContent>
                {plants?.map(p => (
                  <SelectItem key={p.id} value={p.id.toString()} className="font-mono">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Target Date</Label>
            <Input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-[160px] font-mono text-sm border-border bg-background"
            />
          </div>
        </div>
      </div>

      {!selectedPlantId ? (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
            <Activity className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-mono uppercase tracking-wider">Select a plant to view intra-day forecast</p>
          </CardContent>
        </Card>
      ) : forecastLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      ) : forecast ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex flex-col justify-center">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Current Revision</span>
                  <Badge variant="outline" className="bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/50 font-mono">REV {forecast.forecast.revisionNumber || 1}</Badge>
                </div>
                <span className="text-3xl font-bold font-mono text-foreground">{forecast.forecast.totalForecastMwh.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">MWh</span></span>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex flex-col justify-center">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Model Run Time</span>
                <span className="text-3xl font-bold font-mono text-foreground">{format(new Date(forecast.forecast.runAt), "HH:mm")}</span>
              </CardContent>
            </Card>
            <Card className="bg-card border-border bg-gradient-to-br from-card to-muted/20">
              <CardContent className="p-5 flex flex-col justify-center h-full">
                <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm">
                  <Clock className="h-5 w-5" />
                  <span>Real-time tracking active</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border overflow-hidden bg-card">
            <CardHeader className="border-b border-border bg-muted/10 pb-4">
              <CardTitle className="font-mono uppercase tracking-widest text-sm flex justify-between">
                <span>Intra-Day Generation Profile</span>
                <span className="text-[#00E5FF]">{date}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={10} 
                      tickLine={false}
                      minTickGap={30}
                      fontFamily="monospace"
                    />
                    <YAxis 
                      yAxisId="left"
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      fontFamily="monospace"
                      tickFormatter={(value) => `${value} MW`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px', fontFamily: 'monospace' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '8px' }}
                    />
                    
                    {/* Current Time Reference */}
                    <ReferenceLine x={currentTime} yAxisId="left" stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                    
                    <Line 
                      yAxisId="left"
                      type="stepAfter" 
                      dataKey="forecast" 
                      stroke="#00E5FF" 
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: '#00E5FF', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {runs && runs.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="border-b border-border pb-4 bg-muted/10">
                <CardTitle className="font-mono text-sm uppercase tracking-wider">Today's Revisions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {runs.map(run => (
                    <div key={run.id} className="flex justify-between items-center p-4 hover:bg-muted/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm text-foreground flex items-center gap-2">
                          Revision {run.revisionNumber}
                          {run.status === 'available' && <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse"></span>}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">{format(new Date(run.runAt), "HH:mm:ss")}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm text-foreground">{run.totalForecastMwh} MWh</span>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase border ${run.status === 'available' ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/50' : 'bg-muted text-muted-foreground'}`}>
                          {run.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <p className="font-mono uppercase tracking-wider">No forecast available for this date</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
