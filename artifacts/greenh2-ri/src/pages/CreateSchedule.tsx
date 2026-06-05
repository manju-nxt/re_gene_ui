import { useState } from "react";
import { useLocation } from "wouter";
import { format, addDays } from "date-fns";
import { useListPlants, useCreateSchedule } from "@workspace/api-client-react";
import type { ScheduleInput } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function CreateSchedule() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [plantId, setPlantId] = useState<string>("");
  const [date, setDate] = useState<string>(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [type, setType] = useState<"day_ahead" | "intra_day">("day_ahead");
  const [notes, setNotes] = useState("");

  const { data: plants, isLoading: plantsLoading } = useListPlants();
  const createMutation = useCreateSchedule();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!plantId || !date) return;

    createMutation.mutate({
      data: {
        plantId: parseInt(plantId),
        date,
        type,
        notes: notes || undefined,
      } as ScheduleInput
    }, {
      onSuccess: (schedule) => {
        toast({
          title: "Schedule Created",
          description: "Schedule initialized and ready for review.",
        });
        setLocation(`/schedules/${schedule.id}`);
      },
      onError: (err: any) => {
        toast({
          variant: "destructive",
          title: "Creation Failed",
          description: err.message || "An error occurred creating the schedule.",
        });
      }
    });
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-3xl mx-auto font-sans">
      <Link href="/schedules" className="text-muted-foreground hover:text-foreground font-mono text-sm flex items-center gap-2 w-fit transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Schedules
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-primary" />
          Initialize Schedule
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">
          Create a new schedule draft based on the latest AI forecast.
        </p>
      </div>

      <Card className="border-border bg-card shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-3">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Plant Selection</Label>
              <Select value={plantId} onValueChange={setPlantId} required disabled={plantsLoading}>
                <SelectTrigger className="font-mono text-sm bg-background border-border">
                  <SelectValue placeholder="Select a plant to schedule" />
                </SelectTrigger>
                <SelectContent>
                  {plants?.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()} className="font-mono">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Target Date</Label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  required
                  className="font-mono text-sm bg-background border-border"
                />
              </div>

              <div className="space-y-3">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Schedule Type</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)} required>
                  <SelectTrigger className="font-mono text-sm bg-background border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day_ahead" className="font-mono">Day-Ahead</SelectItem>
                    <SelectItem value="intra_day" className="font-mono">Intra-Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Internal Notes (Optional)</Label>
              <Textarea 
                placeholder="Add context for this schedule..." 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="font-mono text-sm bg-background border-border resize-none h-24"
              />
            </div>
            
            <div className="bg-muted/20 p-4 rounded border border-border flex items-start gap-3">
              <CalendarDays className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground font-mono leading-relaxed">
                Initializing will automatically fetch the latest available forecast run for this date and plant. You will have a chance to review and adjust slot values before SLDC submission.
              </p>
            </div>
          </CardContent>
          <CardFooter className="px-6 py-4 border-t border-border bg-muted/10 flex justify-end">
            <Button 
              type="submit" 
              disabled={createMutation.isPending || !plantId || !date}
              className="font-mono uppercase tracking-wider text-xs px-8"
            >
              {createMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing</>
              ) : (
                'Generate Draft'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
