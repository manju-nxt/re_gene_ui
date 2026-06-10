import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "wouter";
import { format } from "date-fns";
import { 
  useGetSchedule, 
  useUpdateSchedule, 
  useSubmitSchedule, 
  useListSubmissions,
  getGetScheduleQueryKey,
  getListSubmissionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowLeft, Save, Send, History, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ScheduleDetail() {
  const { id } = useParams();
  const scheduleId = parseInt(id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: detail, isLoading } = useGetSchedule(scheduleId, { 
    query: { enabled: !!scheduleId, queryKey: getGetScheduleQueryKey(scheduleId) } 
  });
  
  const { data: submissions } = useListSubmissions(scheduleId, {
    query: { enabled: !!scheduleId, queryKey: getListSubmissionsQueryKey(scheduleId) }
  });

  const updateMutation = useUpdateSchedule();
  const submitMutation = useSubmitSchedule();

  // Local state for edits
  const [edits, setEdits] = useState<Record<number, number>>({});
  const initializedId = useRef<number | null>(null);

  // Initialize edits when detail loads
  useEffect(() => {
    if (detail && initializedId.current !== scheduleId) {
      initializedId.current = scheduleId;
      const initialEdits: Record<number, number> = {};
      detail.slots.forEach(slot => {
        initialEdits[slot.slotNumber] = slot.scheduledMw;
      });
      setEdits(initialEdits);
    }
  }, [detail, scheduleId]);

  const handleEdit = (slotNumber: number, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setEdits(prev => ({ ...prev, [slotNumber]: num }));
    } else if (val === "") {
      setEdits(prev => ({ ...prev, [slotNumber]: 0 }));
    }
  };

  const handleSave = () => {
    const slots = Object.entries(edits).map(([slotNumber, scheduledMw]) => ({
      slotNumber: parseInt(slotNumber),
      scheduledMw
    }));

    updateMutation.mutate({
      scheduleId,
      data: { slots }
    }, {
      onSuccess: (updated) => {
        toast({ title: "Adjustments Saved", description: "Schedule draft updated successfully." });
        queryClient.setQueryData(getGetScheduleQueryKey(scheduleId), updated);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Save Failed", description: err.message });
      }
    });
  };

  const handleSubmit = () => {
    submitMutation.mutate({
      scheduleId
    }, {
      onSuccess: () => {
        toast({ title: "Submitted to SLDC", description: "Schedule transmitted successfully." });
        queryClient.invalidateQueries({ queryKey: getGetScheduleQueryKey(scheduleId) });
        queryClient.invalidateQueries({ queryKey: ["/api/schedules"] });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Submission Failed", description: err.message });
      }
    });
  };

  const chartData = useMemo(() => {
    if (!detail) return [];
    return detail.slots.map(s => {
      const currentScheduled = edits[s.slotNumber] ?? s.scheduledMw;
      return {
        time: format(new Date(s.slotStart), "HH:mm"),
        forecast: s.forecastMw,
        scheduled: currentScheduled,
        min: s.minAllowedMw,
        max: s.maxAllowedMw,
        outOfBounds: currentScheduled < s.minAllowedMw || currentScheduled > s.maxAllowedMw
      };
    });
  }, [detail, edits]);

  const totalScheduled = useMemo(() => {
    if (!detail) return 0;
    // rough estimation for display
    return Object.values(edits).reduce((sum, val) => sum + (val / 4), 0); // MW to MWh for 15m blocks
  }, [edits, detail]);

  const isReadOnly = detail?.schedule.status === 'submitted';
  const hasOutOfBounds = chartData.some(d => d.outOfBounds);

  if (isLoading || !detail) {
    return (
      <div className="p-8 space-y-6 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const { schedule, slots } = detail;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <Link href="/schedules" className="text-muted-foreground hover:text-foreground font-mono text-sm flex items-center gap-2 w-fit transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Schedules
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {schedule.plantName}
            </h1>
            <Badge variant="outline" className={`font-mono text-xs uppercase border px-2 py-0.5 ${
              schedule.status === 'submitted' ? 'bg-primary/20 text-primary border-primary/50' :
              schedule.status === 'revised' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' :
              'bg-muted text-muted-foreground border-muted'
            }`}>
              {schedule.status}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono text-sm">
            {schedule.date} • {schedule.type.replace('_', ' ').toUpperCase()} • REV {schedule.revisionNumber || 0}
          </p>
        </div>

        <div className="flex gap-3">
          {!isReadOnly && (
            <Button 
              variant="outline" 
              onClick={handleSave} 
              disabled={updateMutation.isPending}
              className="font-mono uppercase text-xs tracking-wider border-border"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Adjustments
            </Button>
          )}
          {!isReadOnly && (
            <Button 
              onClick={handleSubmit} 
              disabled={submitMutation.isPending || hasOutOfBounds}
              className={`font-mono uppercase text-xs tracking-wider ${hasOutOfBounds ? 'bg-destructive/50 text-destructive-foreground' : ''}`}
            >
              <Send className="h-4 w-4 mr-2" />
              Transmit to SLDC
            </Button>
          )}
        </div>
      </div>

      {hasOutOfBounds && !isReadOnly && (
        <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded-md flex items-center gap-3 font-mono text-sm">
          <AlertTriangle className="h-5 w-5" />
          <span>Warning: Some adjusted slots exceed regulatory deviation limits. Fix red cells before submitting.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">AI Forecast</span>
            <span className="text-2xl font-bold font-mono text-foreground">{schedule.totalForecastMwh.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">MWh</span></span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border ring-1 ring-primary/20">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-xs font-mono uppercase tracking-wider text-primary mb-2">Final Scheduled</span>
            <span className="text-2xl font-bold font-mono text-primary">{totalScheduled.toFixed(1)} <span className="text-sm font-normal text-primary/70">MWh</span></span>
          </CardContent>
        </Card>
        <Card className="bg-card border-border md:col-span-2">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">Submission Deadline</span>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <span className="text-xl font-mono text-foreground">
                {schedule.deadlineAt ? format(new Date(schedule.deadlineAt), "yyyy-MM-dd HH:mm:ss") : 'Not set'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="table" className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList className="bg-muted/20 border border-border">
            <TabsTrigger value="chart" className="font-mono uppercase text-xs tracking-wider">Visual Profile</TabsTrigger>
            <TabsTrigger value="table" className="font-mono uppercase text-xs tracking-wider">Data Grid</TabsTrigger>
            <TabsTrigger value="history" className="font-mono uppercase text-xs tracking-wider">Log</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chart" className="mt-0">
          <Card className="border-border bg-card">
            <CardContent className="p-6">
              <div className="h-[500px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} minTickGap={30} fontFamily="monospace" />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} fontFamily="monospace" tickFormatter={(v) => `${v} MW`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '4px', fontFamily: 'monospace' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                      labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '8px' }}
                    />
                    <Area yAxisId="left" type="stepAfter" dataKey="max" stroke="none" fill="hsl(var(--muted))" fillOpacity={0.2} isAnimationActive={false} />
                    <Area yAxisId="left" type="stepAfter" dataKey="min" stroke="none" fill="hsl(var(--background))" fillOpacity={1} isAnimationActive={false} />
                    
                    <Line yAxisId="left" type="stepAfter" dataKey="forecast" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Forecast" />
                    <Line yAxisId="left" type="stepAfter" dataKey="scheduled" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} name="Scheduled" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <Card className="border-border bg-card">
            <CardContent className="p-0 max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10 shadow-[0_1px_0_hsl(var(--border))]">
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground w-16">Slot</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Time</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Forecast (MW)</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right w-32">Scheduled (MW)</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Bounds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slots.map((slot) => {
                    const currentVal = edits[slot.slotNumber] ?? slot.scheduledMw;
                    const isOutOfBounds = currentVal < slot.minAllowedMw || currentVal > slot.maxAllowedMw;
                    return (
                      <TableRow key={slot.id} className="border-border hover:bg-muted/10">
                        <TableCell className="font-mono text-xs text-muted-foreground">{slot.slotNumber}</TableCell>
                        <TableCell className="font-mono text-sm">{format(new Date(slot.slotStart), "HH:mm")}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">{slot.forecastMw.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            step="0.1"
                            value={currentVal}
                            onChange={(e) => handleEdit(slot.slotNumber, e.target.value)}
                            disabled={isReadOnly}
                            className={`font-mono text-sm text-right h-8 ${
                              isOutOfBounds 
                                ? 'border-destructive text-destructive bg-destructive/10' 
                                : 'bg-background border-border focus-visible:ring-primary'
                            }`}
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          [{slot.minAllowedMw.toFixed(1)} - {slot.maxAllowedMw.toFixed(1)}]
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <Card className="border-border bg-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Timestamp</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Revision</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Status</TableHead>
                    <TableHead className="font-mono text-xs uppercase text-muted-foreground">Ack ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions && submissions.length > 0 ? (
                    submissions.map(log => (
                      <TableRow key={log.id} className="border-border hover:bg-muted/10">
                        <TableCell className="font-mono text-sm">{format(new Date(log.submittedAt), "yyyy-MM-dd HH:mm:ss")}</TableCell>
                        <TableCell className="font-mono text-sm">REV {log.revisionNumber}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`font-mono text-[10px] uppercase border ${
                            log.status === 'success' ? 'bg-primary/20 text-primary border-primary/50' :
                            log.status === 'failed' ? 'bg-destructive/20 text-destructive border-destructive/50' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {log.status === 'success' ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : null}
                            {log.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{log.acknowledgementId || '-'}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground font-mono">No submissions recorded yet.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
