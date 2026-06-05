import { useState } from "react";
import { format, addDays } from "date-fns";
import { useGetDayAheadForecast, useListPlants, useListForecasts } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { LineChart as LineChartIcon, Sunrise, Sunset, Maximize2 } from "lucide-react";

export default function DayAheadForecast() {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [date, setDate] = useState<string>(tomorrow);

  const { data: plants, isLoading: plantsLoading } = useListPlants();
  
  const plantIdNum = selectedPlantId ? parseInt(selectedPlantId) : 0;

  const { data: forecast, isLoading: forecastLoading } = useGetDayAheadForecast(
    { plantId: plantIdNum, date },
    { query: { enabled: !!plantIdNum, queryKey: ["/api/forecasts/day-ahead", { plantId: plantIdNum, date }] } }
  );

  const { data: runs } = useListForecasts(
    { plantId: plantIdNum, type: "day_ahead" },
    { query: { enabled: !!plantIdNum, queryKey: ["/api/forecasts", { plantId: plantIdNum, type: "day_ahead" }] } }
  );

  const chartData = forecast?.slots.map(s => ({
    time: format(new Date(s.slotStart), "HH:mm"),
    forecast: s.forecastMw,
    lower: s.lowerBoundMw,
    upper: s.upperBoundMw,
    irradiance: s.irradianceForecast || 0
  })) || [];

  const peakSlot = forecast?.slots.reduce((max, slot) => slot.forecastMw > max.forecastMw ? slot : max, forecast?.slots[0]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <LineChartIcon className="h-8 w-8 text-primary" />
            Day-Ahead Forecast
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            AI-generated D+1 generation profiles
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
                    {p.name} <span className="text-muted-foreground ml-2">({p.capacityMw} MW)</span>
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
            <LineChartIcon className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-mono uppercase tracking-wider">Select a plant to view forecast</p>
          </CardContent>
        </Card>
      ) : forecastLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      ) : forecast ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex flex-col justify-center">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Total Energy</span>
                <span className="text-3xl font-bold font-mono text-primary">{forecast.forecast.totalForecastMwh.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">MWh</span></span>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex flex-col justify-center">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Peak Generation</span>
                <span className="text-3xl font-bold font-mono text-foreground">{peakSlot?.forecastMw.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">MW</span></span>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex flex-col justify-center">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Peak Time</span>
                <span className="text-3xl font-bold font-mono text-foreground">{peakSlot ? format(new Date(peakSlot.slotStart), "HH:mm") : '--:--'}</span>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex flex-col justify-center">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Model Run Status</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-mono">AVAILABLE</Badge>
                  <span className="text-xs text-muted-foreground font-mono">{format(new Date(forecast.forecast.runAt), "HH:mm")}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border overflow-hidden bg-card">
            <CardHeader className="border-b border-border bg-muted/10 pb-4">
              <CardTitle className="font-mono uppercase tracking-widest text-sm flex justify-between">
                <span>96-Block Generation Profile</span>
                <span className="text-muted-foreground">{date}</span>
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
                    
                    {/* Confidence Band */}
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="upper" 
                      stroke="none" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.1}
                      isAnimationActive={false}
                    />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="lower" 
                      stroke="none" 
                      fill="hsl(var(--background))" 
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                    
                    {/* Main Forecast Line */}
                    <Line 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="forecast" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {runs && runs.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="border-b border-border pb-4 bg-muted/10">
                <CardTitle className="font-mono text-sm uppercase tracking-wider">Recent Model Runs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {runs.slice(0, 5).map(run => (
                    <div key={run.id} className="flex justify-between items-center p-4 hover:bg-muted/10 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm text-foreground">{format(new Date(run.runAt), "yyyy-MM-dd HH:mm:ss")}</span>
                        <span className="font-mono text-xs text-muted-foreground">ID: {run.id} • Target: {run.targetDate}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm text-foreground">{run.totalForecastMwh} MWh</span>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase border ${run.status === 'available' ? 'bg-primary/20 text-primary border-primary/50' : 'bg-muted text-muted-foreground'}`}>
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
