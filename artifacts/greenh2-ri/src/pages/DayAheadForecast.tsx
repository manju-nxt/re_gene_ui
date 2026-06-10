import { useState } from "react";
import { format, addDays } from "date-fns";
import { Link } from "wouter";
import {
  useGetDayAheadForecast,
  useListPlants,
  useListForecasts,
  getGetDayAheadForecastQueryKey,
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
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { LineChart as LineChartIcon, Upload, Thermometer, Wind, Droplets, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DayAheadForecast() {
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [date, setDate] = useState<string>(tomorrow);

  const { data: plants, isLoading: plantsLoading } = useListPlants();
  const plantIdNum = selectedPlantId ? parseInt(selectedPlantId) : 0;

  const { data: forecast, isLoading: forecastLoading } = useGetDayAheadForecast(
    { plantId: plantIdNum, date },
    {
      query: {
        enabled: !!plantIdNum,
        queryKey: getGetDayAheadForecastQueryKey({ plantId: plantIdNum, date }),
      },
    },
  );

  const { data: runs } = useListForecasts(
    { plantId: plantIdNum, type: "day_ahead" },
    {
      query: {
        enabled: !!plantIdNum,
        queryKey: ["/api/forecasts", { plantId: plantIdNum, type: "day_ahead" }],
      },
    },
  );

  const chartData =
    forecast?.slots.map((s) => ({
      time: format(new Date(s.slotStart), "HH:mm"),
      forecast: s.forecastMw,
      lower: s.lowerBoundMw,
      upper: s.upperBoundMw,
      // Show schedule line only where operator actually changed the value
      scheduled:
        s.scheduledMw != null && Math.abs(s.scheduledMw - s.forecastMw) > 0.01
          ? s.scheduledMw
          : null,
    })) || [];

  const hasScheduleOverride = chartData.some((d) => d.scheduled !== null);

  const peakSlot = forecast?.slots.reduce(
    (max, slot) => (slot.forecastMw > max.forecastMw ? slot : max),
    forecast?.slots[0],
  );

  const hasModelInputs = forecast?.slots.some(
    (s) => s.temperature !== null || s.irradianceForecast !== null,
  );

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <LineChartIcon className="h-8 w-8 text-primary" />
            Day-Ahead Forecast
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            AI-generated D+1 generation profiles · Submit to SLDC by 10:00 IST
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
                    {p.name} <span className="text-muted-foreground ml-1">({p.capacityMw} MW)</span>
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
            <LineChartIcon className="h-10 w-10 mb-3 opacity-20" />
            <p className="font-mono uppercase tracking-wider text-sm">Select a plant to view forecast</p>
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
            {[
              { label: "Total Energy", value: `${forecast.forecast.totalForecastMwh.toLocaleString()} MWh`, accent: true },
              { label: "Peak Generation", value: `${peakSlot?.forecastMw.toFixed(1)} MW` },
              { label: "Peak Time (IST)", value: peakSlot ? format(new Date(peakSlot.slotStart), "HH:mm") : "--" },
              { label: "Model Run", value: format(new Date(forecast.forecast.runAt), "HH:mm") },
            ].map(({ label, value, accent }) => (
              <Card key={label} className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                  <p className={`text-2xl font-bold font-mono ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
                </CardContent>
              </Card>
            ))}
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
                      96-Block Generation Profile
                    </CardTitle>
                    <div className="flex items-center gap-4 text-xs font-mono">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-0.5 bg-primary" />
                        Forecast
                      </span>
                      {hasScheduleOverride && (
                        <span className="flex items-center gap-1.5 text-amber-600">
                          <span className="inline-block w-4 border-t-2 border-dashed border-amber-500" />
                          Schedule Override
                        </span>
                      )}
                      <span className="text-muted-foreground">{date}</span>
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
                              scheduled: "Schedule Override",
                            };
                            return [`${value?.toFixed(2)} MW`, labels[name] ?? name];
                          }}
                        />
                        {/* Confidence band */}
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="upper"
                          stroke="none"
                          fill="hsl(var(--primary))"
                          fillOpacity={0.08}
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
                        {/* Forecast line */}
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="forecast"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                        />
                        {/* Operator schedule override line */}
                        {hasScheduleOverride && (
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="scheduled"
                            stroke="#D97706"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={false}
                            connectNulls={false}
                            activeDot={{ r: 4, fill: "#D97706", stroke: "hsl(var(--background))", strokeWidth: 2 }}
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
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Sun className="h-3 w-3" />GHI (W/m²)</span>
                        </TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Thermometer className="h-3 w-3" />Temp (°C)</span>
                        </TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Wind className="h-3 w-3" />Module °C</span>
                        </TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Droplets className="h-3 w-3" />Humidity %</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecast.slots.map((slot) => (
                        <TableRow
                          key={slot.id}
                          className={`border-border hover:bg-muted/10 ${slot.forecastMw === 0 ? "opacity-40" : ""}`}
                        >
                          <TableCell className="font-mono text-xs text-muted-foreground">{slot.slotNumber}</TableCell>
                          <TableCell className="font-mono text-sm">{format(new Date(slot.slotStart), "HH:mm")}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {slot.irradianceForecast != null ? slot.irradianceForecast.toFixed(1) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {slot.temperature != null ? slot.temperature.toFixed(1) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {slot.moduleTemperature != null ? slot.moduleTemperature.toFixed(1) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {slot.humidity != null ? slot.humidity.toFixed(1) : <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Recent model runs */}
          {runs && runs.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="border-b border-border py-3 px-5 bg-muted/30">
                <CardTitle className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Recent Model Runs</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {runs.slice(0, 5).map((run) => (
                    <div key={run.id} className="flex justify-between items-center px-5 py-3 hover:bg-muted/10">
                      <div>
                        <p className="font-mono text-sm text-foreground">{format(new Date(run.runAt), "yyyy-MM-dd HH:mm")}</p>
                        <p className="font-mono text-xs text-muted-foreground">Target: {run.targetDate}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">{run.totalForecastMwh} MWh</span>
                        <Badge variant="outline" className={`font-mono text-[10px] uppercase ${run.status === "available" ? "bg-primary/10 text-primary border-primary/40" : "bg-muted text-muted-foreground"}`}>
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
            <p className="font-mono uppercase tracking-wider text-sm">No forecast available for {date}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
