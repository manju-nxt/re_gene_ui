import { useState, useRef } from "react";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
  useListPlants,
  useListWeatherInputUploads,
  useUploadWeatherInputs,
  getListWeatherInputUploadsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  X,
  Info,
} from "lucide-react";

interface ParsedRow {
  slotNumber: number;
  time: string;
  irradianceGhi: number | null;
  temperature: number | null;
  moduleTemperature: number | null;
  humidity: number | null;
}

function generateTemplate(): void {
  const rows: (string | number)[][] = [
    ["slot_number", "time", "irradiance_ghi", "temperature", "module_temperature", "humidity"],
  ];
  for (let i = 0; i < 96; i++) {
    const startMin = i * 15;
    const h = String(Math.floor(startMin / 60)).padStart(2, "0");
    const m = String(startMin % 60).padStart(2, "0");
    const isDaytime = startMin >= 6 * 60 + 30 && startMin < 18 * 60 + 30;
    rows.push([
      i + 1,
      `${h}:${m}`,
      isDaytime ? "" : 0,
      "",
      "",
      "",
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, "Weather Inputs");
  XLSX.writeFile(wb, "weather_inputs_template.xlsx");
}

function parseFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (raw.length < 2) {
          reject(new Error("File is empty or has no data rows"));
          return;
        }

        // Normalize header row
        const headers = (raw[0] as string[]).map((h) =>
          String(h).toLowerCase().replace(/\s+/g, "_"),
        );

        const colIdx = (names: string[]) => {
          for (const n of names) {
            const i = headers.indexOf(n);
            if (i !== -1) return i;
          }
          return -1;
        };

        const slotCol = colIdx(["slot_number", "slot", "block"]);
        const timeCol = colIdx(["time", "slot_time"]);
        const ghiCol = colIdx(["irradiance_ghi", "ghi", "irradiance", "irradiance_forecast"]);
        const tempCol = colIdx(["temperature", "temp", "ambient_temp", "ambient_temperature"]);
        const moduleTempCol = colIdx([
          "module_temperature",
          "module_temp",
          "panel_temp",
          "panel_temperature",
        ]);
        const humidityCol = colIdx(["humidity", "rh", "relative_humidity"]);

        if (slotCol === -1 && timeCol === -1) {
          reject(new Error("File must have a 'slot_number' or 'time' column"));
          return;
        }

        const rows: ParsedRow[] = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i] as any[];
          if (!row || row.every((c) => c === undefined || c === null || c === "")) continue;

          const slotNum = slotCol !== -1 ? parseInt(row[slotCol]) : i;
          const time =
            timeCol !== -1 ? String(row[timeCol] ?? "") : slotToTime(slotNum - 1);

          if (isNaN(slotNum) || slotNum < 1 || slotNum > 96) continue;

          rows.push({
            slotNumber: slotNum,
            time,
            irradianceGhi: ghiCol !== -1 ? toNum(row[ghiCol]) : null,
            temperature: tempCol !== -1 ? toNum(row[tempCol]) : null,
            moduleTemperature: moduleTempCol !== -1 ? toNum(row[moduleTempCol]) : null,
            humidity: humidityCol !== -1 ? toNum(row[humidityCol]) : null,
          });
        }

        if (rows.length === 0) {
          reject(new Error("No valid data rows found in file"));
          return;
        }

        resolve(rows);
      } catch (err: any) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function toNum(val: any): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(String(val));
  return isNaN(n) ? null : n;
}

function slotToTime(idx: number): string {
  const m = idx * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export default function AdminUpload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [plantId, setPlantId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [type, setType] = useState<"day_ahead" | "intra_day">("day_ahead");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const { data: plants } = useListPlants();
  const { data: uploads, isLoading: uploadsLoading } = useListWeatherInputUploads(
    plantId ? { plantId: parseInt(plantId) } : undefined,
    { query: { queryKey: getListWeatherInputUploadsQueryKey(plantId ? { plantId: parseInt(plantId) } : undefined) } },
  );

  const uploadMutation = useUploadWeatherInputs();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setParsedRows(null);
    setParseError(null);
    setIsParsing(true);
    try {
      const rows = await parseFile(f);
      setParsedRows(rows);
    } catch (err: any) {
      setParseError(err.message ?? "Failed to parse file");
    } finally {
      setIsParsing(false);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setParsedRows(null);
    setParseError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!plantId || !date || !type || !parsedRows || parsedRows.length === 0) return;

    uploadMutation.mutate(
      {
        data: {
          plantId: parseInt(plantId),
          date,
          type,
          filename: file?.name ?? "upload.csv",
          rows: parsedRows,
        },
      },
      {
        onSuccess: (result) => {
          toast({
            title: "Upload Successful",
            description: `${result.rowCount} rows processed. Forecast slots updated.`,
          });
          queryClient.invalidateQueries({
            queryKey: getListWeatherInputUploadsQueryKey(),
          });
          handleClearFile();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Upload Failed",
            description: err.message ?? "Unknown error",
          });
        },
      },
    );
  };

  const isReady = !!plantId && !!date && !!type && !!parsedRows && parsedRows.length > 0;
  const plantName = plants?.find((p) => p.id.toString() === plantId)?.name ?? "";

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto font-sans">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          Admin: Weather Input Upload
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">
          Upload CSV or Excel with per-slot irradiance, temperature and humidity for model re-forecasting
        </p>
      </div>

      {/* Format reference */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border bg-muted/10 pb-3">
          <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            File Format
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs font-mono text-muted-foreground leading-relaxed">
            Upload a CSV or Excel file with 96 rows (one per 15-min block, 00:00–23:45 IST).
            Required column: <span className="text-foreground">slot_number</span> (1–96).
            Optional columns:{" "}
            <span className="text-foreground">irradiance_ghi</span> (W/m²),{" "}
            <span className="text-foreground">temperature</span> (°C),{" "}
            <span className="text-foreground">module_temperature</span> (°C),{" "}
            <span className="text-foreground">humidity</span> (%).
            Missing values are left unchanged.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={generateTemplate}
            className="font-mono text-xs uppercase tracking-wider border-border"
            data-testid="button-download-template"
          >
            <Download className="h-3 w-3 mr-2" />
            Download Template (.xlsx)
          </Button>
        </CardContent>
      </Card>

      {/* Upload form */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border bg-muted/10 pb-4">
          <CardTitle className="font-mono uppercase tracking-wider text-sm">Upload New File</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Plant
              </Label>
              <Select value={plantId} onValueChange={setPlantId}>
                <SelectTrigger
                  className="font-mono text-sm border-border bg-background"
                  data-testid="select-plant"
                >
                  <SelectValue placeholder="Select plant..." />
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

            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Date
              </Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="font-mono text-sm border-border bg-background"
                data-testid="input-date"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Forecast Type
              </Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger
                  className="font-mono text-sm border-border bg-background"
                  data-testid="select-type"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day_ahead" className="font-mono">Day-Ahead</SelectItem>
                  <SelectItem value="intra_day" className="font-mono">Intra-Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              File (CSV or Excel)
            </Label>
            <div className="flex items-center gap-3">
              <label
                className={`flex items-center gap-3 px-4 py-3 rounded-md border cursor-pointer transition-colors w-full max-w-md
                  ${file
                    ? "border-primary/50 bg-primary/5 text-primary"
                    : "border-dashed border-border hover:border-primary/40 hover:bg-muted/10 text-muted-foreground"
                  }`}
                data-testid="label-file-upload"
              >
                <Upload className="h-4 w-4 flex-shrink-0" />
                <span className="font-mono text-sm truncate">
                  {file ? file.name : "Choose file or drag & drop"}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                  data-testid="input-file"
                />
              </label>
              {file && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFile}
                  className="text-muted-foreground hover:text-destructive"
                  data-testid="button-clear-file"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Parse status */}
          {isParsing && (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <Skeleton className="h-3 w-3 rounded-full" />
              Parsing file...
            </div>
          )}
          {parseError && (
            <div className="flex items-center gap-2 text-xs font-mono text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-4 py-3">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {parseError}
            </div>
          )}
          {parsedRows && !parseError && (
            <div className="flex items-center gap-2 text-xs font-mono text-primary bg-primary/10 border border-primary/30 rounded-md px-4 py-3">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Parsed {parsedRows.length} rows successfully. Preview shows first 10 rows below.
            </div>
          )}

          {/* Preview table */}
          {parsedRows && parsedRows.length > 0 && (
            <div className="border border-border rounded-md overflow-auto max-h-[340px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="font-mono text-[10px] uppercase text-muted-foreground">Slot</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-muted-foreground">Time</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-muted-foreground text-right">GHI (W/m²)</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-muted-foreground text-right">Temp (°C)</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-muted-foreground text-right">Module Temp (°C)</TableHead>
                    <TableHead className="font-mono text-[10px] uppercase text-muted-foreground text-right">Humidity (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.slice(0, 10).map((row) => (
                    <TableRow key={row.slotNumber} className="border-border hover:bg-muted/10">
                      <TableCell className="font-mono text-xs text-muted-foreground">{row.slotNumber}</TableCell>
                      <TableCell className="font-mono text-sm">{row.time}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.irradianceGhi !== null ? row.irradianceGhi.toFixed(1) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.temperature !== null ? row.temperature.toFixed(1) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.moduleTemperature !== null ? row.moduleTemperature.toFixed(1) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.humidity !== null ? row.humidity.toFixed(1) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {parsedRows.length > 10 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-xs font-mono text-muted-foreground py-2">
                        ... and {parsedRows.length - 10} more rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSubmit}
              disabled={!isReady || uploadMutation.isPending}
              className="font-mono uppercase text-xs tracking-wider"
              data-testid="button-submit-upload"
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploadMutation.isPending
                ? "Uploading..."
                : `Submit — ${parsedRows?.length ?? 0} rows for ${plantName || "plant"}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload history */}
      <Card className="border-border bg-card">
        <CardHeader className="border-b border-border bg-muted/10 pb-4">
          <CardTitle className="font-mono text-sm uppercase tracking-wider">Upload History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {uploadsLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : uploads && uploads.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Uploaded</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Plant</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Date</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Type</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Filename</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground text-right">Rows</TableHead>
                  <TableHead className="font-mono text-xs uppercase text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((u) => (
                  <TableRow key={u.id} className="border-border hover:bg-muted/10">
                    <TableCell className="font-mono text-sm">
                      {format(new Date(u.uploadedAt), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {plants?.find((p) => p.id === u.plantId)?.name ?? `Plant ${u.plantId}`}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{u.date}</TableCell>
                    <TableCell className="font-mono text-xs uppercase text-muted-foreground">
                      {u.type.replace("_", " ")}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground max-w-[200px] truncate">
                      {u.filename}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{u.rowCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`font-mono text-[10px] uppercase border ${
                          u.status === "processed"
                            ? "bg-primary/20 text-primary border-primary/50"
                            : "bg-destructive/20 text-destructive border-destructive/50"
                        }`}
                      >
                        {u.status === "processed" ? (
                          <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 mr-1 inline" />
                        )}
                        {u.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex items-center justify-center h-32 text-muted-foreground font-mono text-sm">
              No uploads yet. Upload your first weather input file above.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
