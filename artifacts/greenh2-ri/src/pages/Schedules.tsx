import { useState } from "react";
import { Link } from "wouter";
import { format, differenceInHours } from "date-fns";
import { useListSchedules, useListPlants } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, Plus, Clock, ExternalLink } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ListSchedulesStatus } from "@workspace/api-client-react";

export default function Schedules() {
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [statusTab, setStatusTab] = useState<ListSchedulesStatus | "all">("all");

  const { data: plants } = useListPlants();

  const queryParams: any = {};
  if (selectedPlantId && selectedPlantId !== "all") queryParams.plantId = parseInt(selectedPlantId);
  if (date) queryParams.date = date;
  if (statusTab !== "all") queryParams.status = statusTab;

  const { data: schedules, isLoading } = useListSchedules(
    Object.keys(queryParams).length > 0 ? queryParams : undefined,
    { query: { queryKey: ["/api/schedules", queryParams] } }
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted': return <Badge variant="outline" className="bg-primary/20 text-primary border-primary/50 font-mono text-[10px] uppercase">SUBMITTED</Badge>;
      case 'draft': return <Badge variant="outline" className="bg-muted text-muted-foreground border-muted font-mono text-[10px] uppercase">DRAFT</Badge>;
      case 'revised': return <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/50 font-mono text-[10px] uppercase">REVISED</Badge>;
      default: return <Badge variant="outline" className="font-mono text-[10px] uppercase">{status}</Badge>;
    }
  };

  const renderDeadline = (deadlineStr?: string | null) => {
    if (!deadlineStr) return <span className="text-muted-foreground">-</span>;
    const deadline = new Date(deadlineStr);
    const now = new Date();
    const hrs = differenceInHours(deadline, now);
    
    const isPast = deadline < now;
    const isUrgent = hrs >= 0 && hrs < 2;

    return (
      <div className={`flex items-center gap-1 ${isPast ? 'text-muted-foreground line-through' : isUrgent ? 'text-destructive font-bold' : 'text-foreground'}`}>
        <Clock className="h-3 w-3" />
        {format(deadline, "HH:mm")}
        {isUrgent && <span className="text-[10px] ml-1 bg-destructive/20 px-1 rounded">{'<2h'}</span>}
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" />
            Schedule Management
          </h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            SLDC submissions and adjustment workflows
          </p>
        </div>
        
        <Link href="/schedules/new">
          <Button className="font-mono uppercase tracking-wider text-xs">
            <Plus className="h-4 w-4 mr-2" />
            New Schedule
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 flex flex-wrap gap-4 items-end shadow-sm">
        <div className="space-y-1 w-full sm:w-[240px]">
          <Select value={selectedPlantId} onValueChange={setSelectedPlantId}>
            <SelectTrigger className="font-mono text-sm border-border bg-background">
              <SelectValue placeholder="All Plants" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-mono">All Plants</SelectItem>
              {plants?.map(p => (
                <SelectItem key={p.id} value={p.id.toString()} className="font-mono">{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 w-full sm:w-[160px]">
          <Input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)} 
            className="font-mono text-sm border-border bg-background"
          />
        </div>
        {date && (
          <Button variant="ghost" size="sm" onClick={() => setDate("")} className="font-mono text-xs uppercase">
            Clear Date
          </Button>
        )}
      </div>

      <Card className="border-border bg-card overflow-hidden">
        <Tabs value={statusTab ?? "all"} onValueChange={(v) => setStatusTab(v as any)} className="w-full">
          <div className="border-b border-border bg-muted/10 px-4 pt-4 flex justify-between items-center">
            <TabsList className="bg-transparent border-b-0 space-x-2">
              <TabsTrigger value="all" className="font-mono uppercase text-xs tracking-wider data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none">All</TabsTrigger>
              <TabsTrigger value="draft" className="font-mono uppercase text-xs tracking-wider data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none">Drafts</TabsTrigger>
              <TabsTrigger value="submitted" className="font-mono uppercase text-xs tracking-wider data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none">Submitted</TabsTrigger>
              <TabsTrigger value="revised" className="font-mono uppercase text-xs tracking-wider data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none">Revised</TabsTrigger>
            </TabsList>
          </div>
          
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Date</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Plant</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Type</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider text-right">Energy (MWh)</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Status</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider">Deadline</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground tracking-wider text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : schedules && schedules.length > 0 ? (
                  schedules.map((schedule) => (
                    <TableRow key={schedule.id} className="border-border hover:bg-muted/30 transition-colors group">
                      <TableCell className="font-mono text-sm">{schedule.date}</TableCell>
                      <TableCell className="font-medium text-foreground">{schedule.plantName}</TableCell>
                      <TableCell className="font-mono text-xs uppercase text-muted-foreground">{schedule.type.replace('_', ' ')}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-foreground">{schedule.totalScheduledMwh.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {getStatusBadge(schedule.status)}
                          {schedule.revisionNumber !== undefined && schedule.revisionNumber > 0 && (
                            <span className="text-[10px] text-muted-foreground font-mono">REV {schedule.revisionNumber}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {renderDeadline(schedule.deadlineAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/schedules/${schedule.id}`}>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity font-mono text-xs text-primary hover:text-primary">
                            Review <ExternalLink className="h-3 w-3 ml-2" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-mono">
                      No schedules found matching criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
