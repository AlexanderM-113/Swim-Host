import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Download, Trash2 } from "lucide-react";
import {
  subscribeToLogs,
  clearLogs,
  downloadLogs,
  type LogEntry,
  type LogLevel,
} from "@/lib/logger";

const LEVEL_STYLES: Record<LogLevel, string> = {
  error: "bg-destructive/10 text-destructive border-destructive/20",
  warn: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  info: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  debug: "bg-muted text-muted-foreground border-border",
};

export function DiagnosticsLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => subscribeToLogs(setLogs), []);

  const recent = [...logs].reverse().slice(0, 50);
  const errorCount = logs.filter((l) => l.level === "error").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5" />
          <CardTitle>Diagnostics &amp; Logs</CardTitle>
        </div>
        <CardDescription>
          Recent activity and errors captured on this device. Download the log if you need to report a problem.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline">{logs.length} entries</Badge>
          {errorCount > 0 && (
            <Badge variant="outline" className={LEVEL_STYLES.error}>
              {errorCount} error{errorCount === 1 ? "" : "s"}
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={downloadLogs} disabled={logs.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs} disabled={logs.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        <div className="max-h-72 overflow-auto rounded-md border bg-muted/30 divide-y divide-border text-xs font-mono">
          {recent.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No log entries yet.</div>
          ) : (
            recent.map((e) => (
              <div key={e.id} className="flex items-start gap-2 px-3 py-1.5">
                <span className="text-muted-foreground shrink-0">{e.ts.slice(11, 19)}</span>
                <Badge variant="outline" className={`shrink-0 px-1.5 py-0 text-[10px] ${LEVEL_STYLES[e.level]}`}>
                  {e.level}
                </Badge>
                <span className="break-all">
                  {e.message}
                  {e.count > 1 && <span className="text-muted-foreground"> (x{e.count})</span>}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
