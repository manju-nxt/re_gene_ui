import { useState } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import {
  useGetIntraDayForecast,
  useListPlants,
  useListForecasts,
  getGetIntraDayForecastQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Activity, Clock, Upload, Thermometer, Wind, Droplets, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IntraDayForecast() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [date, setDate] = useState<string>(today);

  const { data: plants, isLoading: plantsLoading } = useListPlants();
  const plantIdNum = selectedPlantId ? parseInt(selectedPlantId) : 0;

  const { data: forecast, isLoading: forecastLoading } = useGetIntraDayForecast(
    { plantId: plantIdNum, date },
    {
      query: {
        enabled: !!plantIdNum,
        queryKey: getGetIntraDayForecastQueryKey({ plantId: plantIdNum, date }),
      },
    },
  );

  const { data: runs } = useListForecasts(
    { plantId: plantIdNum, type: "intra_day", date },
    {
      query: {
        enabled: !!plantIdNum,
        queryKey: ["/api/forecasts", { plantId: plantIdNum, type: "intra_day", date }],
      },
    },
  );

  const nowTimeStr = format(new Date(), "HH:mm");

  const chartData =
    forecast?.slots.map((s) => ({
      time: format(new Date(s.slotStart), "HH:mm"),
      forecast: s.forecastMw,
      actual: s.actualMw ?? null,
      scheduled:
        s.scheduledMw != null && Math.abs(s.scheduledMw - s.forecastMw) > 0.01
          ? s.scheduledMw
          : null,
    })) || [];

  const hasActuals = chartData.some((d) => d.actual !== null && d.actual > 0);
  const hasScheduleOverride = chartData.some((d) => d.scheduled !== null);
  const hasModelInputs = forecast?.slots.some(
    (s) => s.temperature !== null || s.irradianceForecast !== null,
  );

  // Compute actual vs forecast deviation for past blocks
  const pastSlots = forecast?.slots.filter((s) => s.actualMw !== null && s.forecastMw > 0) ?? [];
  const avgDevPct =
    pastSlots.length > 0
      ? pastSlots.reduce((acc, s) => acc + Math.abs((s.actualMw! - s.forecastMw) / s.forecastMw) * 100, 0) /
        pastSlots.length
      : null;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-500" />
            Intra-Day Forecast
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Real-time block revisions with actuals overlay
          </p>
        </div>
        <div className="flex gap-4 items-end bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="space-y-1">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Plant</Label>
            <Select value={selectedPlantId} onValueChange={setSelectedPlantId} disabled={plantsLoading}>
              <SelectTrigger className="w-[220px] font-mono text-sm" data-testid="select-plant">
                <SelectValue placeholder="Select a plant..." />
              </SelectTrigger>
              <SelectContent>
                {plants?.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()} className="font-mono">
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Date</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[148px] font-mono text-sm"
              data-testid="input-date"
            />
          </div>
        </div>
      </div>

      {!selectedPlantId ? (
        <Card className="border-dashed border-2 bg-transparent">
          <CardContent className="flex flex-col items-center justify-center h-[360px] text-muted-foreground">
            <Activity className="h-10 w-10 mb-3 opacity-20" />
            <p className="font-mono uppercase tracking-wider text-sm">Select a plant to view intra-day forecast</p>
          </CardContent>
        </Card>
      ) : forecastLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-[460px] w-full" />
        </div>
      ) : forecast ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Remaining Forecast</p>
                <p className="text-2xl font-bold font-mono text-blue-600">
                  {forecast.forecast.totalForecastMwh.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">MWh</span>
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Revision</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 font-mono">
                    REV {forecast.forecast.revisionNumber || 1}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {format(new Date(forecast.forecast.runAt), "HH:mm")}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Actual Blocks</p>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {pastSlots.length} <span className="text-sm font-normal text-muted-foreground">/ 96</span>
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">Avg Deviation</p>
                <p className={`text-2xl font-bold font-mono ${avgDevPct !== null && avgDevPct > 5 ? "text-amber-600" : "text-green-600"}`}>
                  {avgDevPct !== null ? `${avgDevPct.toFixed(1)}%` : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="chart" className="w-full">
            <div className="flex justify-between items-center mb-3">
              <TabsList className="border border-border">
                <TabsTrigger value="chart" className="font-mono uppercase text-xs tracking-wider">Generation Profile</TabsTrigger>
                <TabsTrigger value="inputs" className="font-mono uppercase text-xs tracking-wider">Model Inputs</TabsTrigger>
              </TabsList>
              {!hasModelInputs && (
                <Link href="/admin/upload">
                  <Button variant="outline" size="sm" className="font-mono text-xs uppercase tracking-wider">
                    <Upload className="h-3 w-3 mr-2" />Upload Inputs
                  </Button>
                </Link>
              )}
            </div>

            {/* ── CHART TAB ─────────────────────────────────────────────── */}
            <TabsContent value="chart" className="mt-0">
              <Card className="border-border overflow-hidden bg-card">
                <CardHeader className="border-b border-border bg-muted/30 py-3 px-5">
                  <div className="flex justify-between items-center">
                    <CardTitle className="font-mono uppercase tracking-widest text-xs text-muted-foreground">
                      Intra-Day Profile
                    </CardTitle>
                    <div className="flex items-center gap-4 text-xs font-mono flex-wrap justify-end">
                      <span className="flex items-center gap-1.5 text-blue-600">
                        <span className="inline-block w-4 h-0.5 bg-blue-500" />
                        Forecast
                      </span>
                      {hasActuals && (
                        <span className="flex items-center gap-1.5 text-amber-600">
                          <span className="inline-block w-4 h-0.5 bg-amber-500" />
                          Actual
                        </span>
                      )}
                      {hasScheduleOverride && (
                        <span className="flex items-center gap-1.5 text-purple-600">
                          <span className="inline-block w-4 border-t-2 border-dashed border-purple-500" />
                          Schedule Override
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="inline-block w-4 border-t border-dashed border-muted-foreground" />
                        Now ({nowTimeStr})
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="h-[460px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData} margin={{ top: 16, right: 16, bottom: 16, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                          dataKey="time"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={10}
                          tickLine={false}
                          minTickGap={32}
                          fontFamily="monospace"
                        />
                        <YAxis
                          yAxisId="left"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          fontFamily="monospace"
                          tickFormatter={(v) => `${v} MW`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "6px",
                            fontFamily: "monospace",
                            fontSize: 12,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          labelStyle={{ color: "hsl(var(--muted-foreground))", marginBottom: 4 }}
                          formatter={(value: number, name: string) => {
                            const labels: Record<string, string> = {
                              forecast: "Forecast",
                              actual: "Actual",
                              scheduled: "Schedule Override",
                            };
                            return [`${value?.toFixed(2)} MW`, labels[name] ?? name];
                          }}
                        />
                        {/* Current-time reference line */}
                        <ReferenceLine
                          x={nowTimeStr}
                          yAxisId="left"
                          stroke="hsl(var(--muted-foreground))"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                        />
                        {/* Forecast line */}
                        <Line
                          yAxisId="left"
                          type="stepAfter"
                          dataKey="forecast"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: "#3B82F6", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                        />
                        {/* Actual line — only has values for past blocks */}
                        {hasActuals && (
                          <Line
                            yAxisId="left"
                            type="stepAfter"
                            dataKey="actual"
                            stroke="#F59E0B"
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls={false}
                            activeDot={{ r: 4, fill: "#F59E0B", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                          />
                        )}
                        {/* Operator schedule override */}
                        {hasScheduleOverride && (
                          <Line
                            yAxisId="left"
                            type="stepAfter"
                            dataKey="scheduled"
                            stroke="#A855F7"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={false}
                            connectNulls={false}
                            activeDot={{ r: 4, fill: "#A855F7", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── MODEL INPUTS TAB ──────────────────────────────────────── */}
            <TabsContent value="inputs" className="mt-0">
              <Card className="border-border bg-card">
                <CardHeader className="border-b border-border bg-muted/30 py-3 px-5 flex flex-row items-center justify-between">
                  <CardTitle className="font-mono uppercase tracking-widest text-xs text-muted-foreground">
                    Model Input Parameters — {date}
                  </CardTitle>
                  <Link href="/admin/upload">
                    <Button variant="outline" size="sm" className="font-mono text-xs uppercase tracking-wider">
                      <Upload className="h-3 w-3 mr-2" />Upload / Update
                    </Button>
                  </Link>
                </CardHeader>
                {!hasModelInputs && (
                  <div className="px-5 py-2 bg-amber-50 border-b border-amber-200 text-xs font-mono text-amber-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    No weather inputs uploaded. Upload a file to populate model parameters.
                  </div>
                )}
                <CardContent className="p-0 max-h-[560px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground w-14">Slot</TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground w-16">Time</TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Forecast</TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Actual</TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Sun className="h-3 w-3" />GHI (W/m²)</span>
                        </TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Thermometer className="h-3 w-3" />Temp °C</span>
                        </TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Droplets className="h-3 w-3" />Humidity %</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecast.slots.map((slot) => {
                        const hasPassed = slot.actualMw !== null;
                        const dev =
                          hasPassed && slot.forecastMw > 0
                            ? ((slot.actualMw! - slot.forecastMw) / slot.forecastMw) * 100
                            : null;
                        return (
                          <TableRow
                            key={slot.id}
                            className={`border-border hover:bg-muted/10 ${!hasPassed && slot.forecastMw === 0 ? "opacity-40" : ""}`}
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">{slot.slotNumber}</TableCell>
                            <TableCell className="font-mono text-sm">{format(new Date(slot.slotStart), "HH:mm")}</TableCell>
                            <TableCell className="text-right font-mono text-sm">{slot.forecastMw.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {slot.actualMw != null ? (
                                <span className={dev !== null && Math.abs(dev) > 5 ? "text-amber-600 font-semibold" : "text-foreground"}>
                                  {slot.actualMw.toFixed(2)}
                                  {dev !== null && (
                                    <span className="ml-1 text-[10px] text-muted-foreground">
                                      ({dev >= 0 ? "+" : ""}{dev.toFixed(1)}%)
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {slot.irradianceForecast != null ? slot.irradianceForecast.toFixed(1) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {slot.temperature != null ? slot.temperature.toFixed(1) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {slot.humidity != null ? slot.humidity.toFixed(1) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Today's revisions */}
          {runs && runs.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="border-b border-border py-3 px-5 bg-muted/30">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Today's Revisions</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {runs.map((run) => (
                    <div key={run.id} className="flex justify-between items-center px-5 py-3 hover:bg-muted/10">
                      <div>
                        <p className="font-mono text-sm text-foreground flex items-center gap-2">
                          Revision {run.revisionNumber}
                          {run.status === "available" && (
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                          )}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{format(new Date(run.runAt), "HH:mm:ss")}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">{run.totalForecastMwh} MWh</span>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase ${run.status === "available" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-muted text-muted-foreground"}`}>
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
          <CardContent className="flex flex-col items-center justify-center h-[180px] text-muted-foreground">
            <p className="font-mono uppercase tracking-wider text-sm">No intra-day forecast for {date}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
