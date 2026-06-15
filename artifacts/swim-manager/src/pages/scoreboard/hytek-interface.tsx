import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plug, PlugZap, Copy, Download, Cable } from "lucide-react";
import {
  ScoreboardSerialBridge,
  assembleScoreboardResponse,
  isWebSerialSupported,
  type BridgeLogEntry,
  type BridgeStatus,
} from "@/lib/scoreboard-serial";
import {
  parseScoreboardRequest,
  buildScoreboardRequest,
  SB_FORMAT,
} from "@/lib/scoreboard-protocol";

const PREVIEW_FORMATS = [
  { value: SB_FORMAT.START_LIST, label: "Start List (current heat)" },
  { value: SB_FORMAT.RESULT_LIST, label: "Result List (rank set 1)" },
  { value: SB_FORMAT.COMPLETE_RESULT, label: "Complete Event Result" },
  { value: SB_FORMAT.TEAM_SCORE_COMBINED, label: "Team Scores — Combined" },
  { value: SB_FORMAT.TEAM_SCORE_WOMEN, label: "Team Scores — Women" },
  { value: SB_FORMAT.TEAM_SCORE_MEN, label: "Team Scores — Men" },
];

const STATUS_STYLE: Record<BridgeStatus, string> = {
  disconnected: "bg-slate-600 text-white",
  connecting: "bg-amber-500 text-black",
  connected: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
};

/** Render a raw response string with control characters made visible. */
function visualize(s: string): string {
  return s
    .replace(/\x0d/g, "␍")
    .replace(/\x02/g, "␂")
    .replace(/\x04/g, "␃");
}

export default function HytekInterfacePanel({
  meetId,
  eventNumber,
  heatNumber,
  round,
  onClose,
}: {
  meetId: number | null;
  eventNumber: number | null;
  heatNumber: number | null;
  round: "P" | "S" | "F";
  onClose: () => void;
}) {
  const supported = isWebSerialSupported();
  const [status, setStatus] = useState<BridgeStatus>("disconnected");
  const [statusDetail, setStatusDetail] = useState<string>("");
  const [log, setLog] = useState<BridgeLogEntry[]>([]);
  const [previewFormat, setPreviewFormat] = useState<string>(SB_FORMAT.START_LIST);
  const bridgeRef = useRef<ScoreboardSerialBridge | null>(null);

  // Keep the latest meet id available to the bridge without reconnecting.
  const meetIdRef = useRef<number | null>(meetId);
  useEffect(() => { meetIdRef.current = meetId; }, [meetId]);

  useEffect(() => {
    return () => { void bridgeRef.current?.disconnect(); };
  }, []);

  const connect = async () => {
    // Tear down any prior bridge (e.g. after a read error left the port open)
    // so we never leak the COM port and can reopen the same one.
    await bridgeRef.current?.disconnect();
    const bridge = new ScoreboardSerialBridge({
      getMeetId: () => meetIdRef.current,
      onStatus: (s, detail) => { setStatus(s); setStatusDetail(detail ?? ""); },
      onLog: (entry) => setLog((prev) => [entry, ...prev].slice(0, 100)),
    });
    bridgeRef.current = bridge;
    try {
      await bridge.connect();
    } catch {
      /* status already reflects the error */
    }
  };

  const disconnect = async () => {
    await bridgeRef.current?.disconnect();
    bridgeRef.current = null;
  };

  const preview = useMemo(() => {
    if (meetId == null) return "";
    const isTeam = [
      SB_FORMAT.TEAM_SCORE_COMBINED,
      SB_FORMAT.TEAM_SCORE_WOMEN,
      SB_FORMAT.TEAM_SCORE_MEN,
    ].includes(previewFormat as never);
    if (!isTeam && eventNumber == null) return "";

    let field2 = "";
    if (previewFormat === SB_FORMAT.START_LIST) field2 = String(heatNumber ?? 1);
    else if (previewFormat === SB_FORMAT.RESULT_LIST) field2 = "1";
    else if (previewFormat === SB_FORMAT.COMPLETE_RESULT) field2 = round;

    const evNo = isTeam ? (eventNumber ?? 999) : (eventNumber ?? 0);
    const reqStr = buildScoreboardRequest(evNo, field2, previewFormat);
    const req = parseScoreboardRequest(reqStr);
    if (!req) return "";
    return assembleScoreboardResponse(req, meetId) ?? "";
  }, [meetId, eventNumber, heatNumber, round, previewFormat]);

  const copyPreview = () => { void navigator.clipboard.writeText(preview); };
  const downloadPreview = () => {
    const blob = new Blob([preview], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scoreboard-${previewFormat}-evt${eventNumber ?? "all"}.bin`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="shrink-0 rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cable className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Generic Scoreboard Interface (Hy-Tek)</h3>
          <Badge className={STATUS_STYLE[status]} title={statusDetail}>
            {status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : status === "error" ? "Error" : "Offline"}
          </Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Serves start lists, results, complete event results, and team scores to a
        vendor scoreboard (Daktronics, Colorado Time, etc.) over a serial COM port
        using the Hy-Tek Generic Scoreboard format. Port settings:{" "}
        <span className="font-mono">9600 · 7 data · Even parity · 2 stop</span>.
      </p>

      {!supported ? (
        <div className="text-xs rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-700 dark:text-amber-400">
          Web Serial isn't available in this browser. Run the desktop (Electron)
          build or use Chrome/Edge to connect a physical scoreboard. You can still
          preview and export the exact response bytes below.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {status === "connected" ? (
            <Button size="sm" variant="destructive" onClick={disconnect}>
              <PlugZap className="h-4 w-4 mr-1" /> Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={connect} disabled={status === "connecting"}>
              <Plug className="h-4 w-4 mr-1" /> Connect COM Port
            </Button>
          )}
          {statusDetail && status === "error" && (
            <span className="text-xs text-red-600">{statusDetail}</span>
          )}
        </div>
      )}

      {/* Preview / export */}
      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium">Preview response:</span>
          <Select value={previewFormat} onValueChange={setPreviewFormat}>
            <SelectTrigger className="w-[230px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PREVIEW_FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={copyPreview} disabled={!preview} className="h-8">
            <Copy className="h-3.5 w-3.5 mr-1" /> Copy
          </Button>
          <Button size="sm" variant="outline" onClick={downloadPreview} disabled={!preview} className="h-8">
            <Download className="h-3.5 w-3.5 mr-1" /> Export .bin
          </Button>
          {preview && (
            <span className="text-[10px] text-muted-foreground font-mono">{preview.length} bytes</span>
          )}
        </div>
        <pre className="text-[11px] font-mono bg-muted rounded p-2 overflow-x-auto whitespace-pre max-h-40 border">
          {preview ? visualize(preview) : "Select a meet/event to preview the formatted output."}
        </pre>
      </div>

      {/* Live request log */}
      {log.length > 0 && (
        <div className="space-y-1 border-t pt-3">
          <span className="text-xs font-medium">Request log</span>
          <div className="max-h-32 overflow-y-auto rounded border bg-muted/50 p-2 space-y-0.5">
            {log.map((e, i) => (
              <div key={i} className="text-[11px] font-mono flex gap-2">
                <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className={e.dir === "in" ? "text-blue-600" : e.dir === "out" ? "text-green-600" : "text-muted-foreground"}>
                  {e.dir === "in" ? "←" : e.dir === "out" ? "→" : "·"}
                </span>
                <span>{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
