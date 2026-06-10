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
    })) || [];

  const peakSlot = forecast?.slots.reduce(
    (max, slot) => (slot.forecastMw > max.forecastMw ? slot : max),
    forecast?.slots[0],
  );

  const hasModelInputs = forecast?.slots.some(
    (s) => s.temperature !== null || s.irradianceForecast !== null,
  );

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
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Select Plant
            </Label>
            <Select
              value={selectedPlantId}
              onValueChange={setSelectedPlantId}
              disabled={plantsLoading}
            >
              <SelectTrigger
                className="w-[240px] font-mono text-sm border-border bg-background"
                data-testid="select-plant"
              >
                <SelectValue placeholder="Select a plant..." />
              </SelectTrigger>
              <SelectContent>
                {plants?.map((p) => (
                  <SelectItem key={p.id} value={p.id.toString()} className="font-mono">
                    {p.name}{" "}
                    <span className="text-muted-foreground ml-2">({p.capacityMw} MW)</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Target Date
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-[160px] font-mono text-sm border-border bg-background"
              data-testid="input-date"
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
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  Total Energy
                </span>
                <span className="text-3xl font-bold font-mono text-primary">
                  {forecast.forecast.totalForecastMwh.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-muted-foreground">MWh</span>
                </span>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex flex-col justify-center">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  Peak Generation
                </span>
                <span className="text-3xl font-bold font-mono text-foreground">
                  {peakSlot?.forecastMw.toFixed(1)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">MW</span>
                </span>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex flex-col justify-center">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  Peak Time
                </span>
                <span className="text-3xl font-bold font-mono text-foreground">
                  {peakSlot ? format(new Date(peakSlot.slotStart), "HH:mm") : "--:--"}
                </span>
              </CardContent>
            </Card>
            <Card className="bg-card border-border">
              <CardContent className="p-5 flex flex-col justify-center">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  Model Run
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/30 font-mono"
                  >
                    AVAILABLE
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    {format(new Date(forecast.forecast.runAt), "HH:mm")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="chart" className="w-full">
            <div className="flex justify-between items-center mb-4">
              <TabsList className="bg-muted/20 border border-border">
                <TabsTrigger
                  value="chart"
                  className="font-mono uppercase text-xs tracking-wider"
                  data-testid="tab-chart"
                >
                  Generation Profile
                </TabsTrigger>
                <TabsTrigger
                  value="inputs"
                  className="font-mono uppercase text-xs tracking-wider"
                  data-testid="tab-model-inputs"
                >
                  Model Inputs
                </TabsTrigger>
              </TabsList>
              {!hasModelInputs && (
                <Link href="/admin/upload">
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs uppercase tracking-wider border-border"
                  >
                    <Upload className="h-3 w-3 mr-2" />
                    Upload Inputs
                  </Button>
                </Link>
              )}
            </div>

            <TabsContent value="chart" className="mt-0">
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
                      <ComposedChart
                        data={chartData}
                        margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          vertical={false}
                        />
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
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            borderColor: "hsl(var(--border))",
                            borderRadius: "4px",
                            fontFamily: "monospace",
                          }}
                          itemStyle={{ color: "hsl(var(--foreground))" }}
                          labelStyle={{
                            color: "hsl(var(--muted-foreground))",
                            marginBottom: "8px",
                          }}
                        />
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
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="forecast"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          dot={false}
                          activeDot={{
                            r: 6,
                            fill: "hsl(var(--primary))",
                            stroke: "hsl(var(--background))",
                            strokeWidth: 2,
                          }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inputs" className="mt-0">
              <Card className="border-border bg-card">
                <CardHeader className="border-b border-border bg-muted/10 pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="font-mono uppercase tracking-widest text-sm">
                    Model Input Parameters — {date}
                  </CardTitle>
                  <Link href="/admin/upload">
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-mono text-xs uppercase tracking-wider border-border"
                    >
                      <Upload className="h-3 w-3 mr-2" />
                      Upload / Update
                    </Button>
                  </Link>
                </CardHeader>
                {!hasModelInputs && (
                  <div className="px-6 py-3 bg-muted/10 border-b border-border text-xs font-mono text-muted-foreground flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    No weather inputs uploaded for this date. Values shown are defaults from the forecast model.
                  </div>
                )}
                <CardContent className="p-0 max-h-[600px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_hsl(var(--border))]">
                      <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground w-14">Slot</TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground w-16">Time</TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Sun className="h-3 w-3" /> GHI (W/m²)</span>
                        </TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Thermometer className="h-3 w-3" /> Temp (°C)</span>
                        </TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Wind className="h-3 w-3" /> Module Temp (°C)</span>
                        </TableHead>
                        <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">
                          <span className="flex items-center justify-end gap-1"><Droplets className="h-3 w-3" /> Humidity (%)</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {forecast.slots.map((slot) => {
                        const isDaytime = slot.forecastMw > 0;
                        return (
                          <TableRow
                            key={slot.id}
                            className={`border-border hover:bg-muted/10 ${!isDaytime ? "opacity-40" : ""}`}
                            data-testid={`row-model-input-${slot.slotNumber}`}
                          >
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {slot.slotNumber}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {format(new Date(slot.slotStart), "HH:mm")}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {slot.irradianceForecast !== null && slot.irradianceForecast !== undefined
                                ? slot.irradianceForecast.toFixed(1)
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {slot.temperature !== null && slot.temperature !== undefined
                                ? slot.temperature.toFixed(1)
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {slot.moduleTemperature !== null && slot.moduleTemperature !== undefined
                                ? slot.moduleTemperature.toFixed(1)
                                : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {slot.humidity !== null && slot.humidity !== undefined
                                ? slot.humidity.toFixed(1)
                                : <span className="text-muted-foreground">—</span>}
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

          {runs && runs.length > 0 && (
            <Card className="border-border bg-card">
              <CardHeader className="border-b border-border pb-4 bg-muted/10">
                <CardTitle className="font-mono text-sm uppercase tracking-wider">
                  Recent Model Runs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {runs.slice(0, 5).map((run) => (
                    <div
                      key={run.id}
                      className="flex justify-between items-center p-4 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-sm text-foreground">
                          {format(new Date(run.runAt), "yyyy-MM-dd HH:mm:ss")}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          ID: {run.id} • Target: {run.targetDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm text-foreground">
                          {run.totalForecastMwh} MWh
                        </span>
                        <Badge
                          variant="outline"
                          className={`font-mono text-[10px] uppercase border ${run.status === "available" ? "bg-primary/20 text-primary border-primary/50" : "bg-muted text-muted-foreground"}`}
                        >
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
