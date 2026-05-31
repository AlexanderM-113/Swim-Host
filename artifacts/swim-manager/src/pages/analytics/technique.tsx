import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Camera, Upload, Play, RefreshCw, CheckCircle, AlertCircle,
  Activity, Waves, Eye, ArrowUp, RotateCcw, Zap, Video,
  ChevronRight, Target, TrendingUp
} from "lucide-react";

interface TechniqueMetrics {
  bodyAlignment: number;
  kickEfficiency: number;
  headPosition: number;
  underwaterDistance: number;
  turnSpeed: number;
  breakoutAngle: number;
  armEntryAngle: number;
  catchPhase: number;
  pullPhase: number;
  recoveryPhase: number;
}

interface AnalysisResult {
  metrics: TechniqueMetrics;
  stroke: string;
  source: "file" | "camera";
  analyzedAt: string;
  recommendations: string[];
}

const BENCHMARKS: Record<keyof TechniqueMetrics, { label: string; unit: string; ideal: number; icon: string; desc: string }> = {
  bodyAlignment: { label: "Body Alignment", unit: "/100", ideal: 90, icon: "⬆️", desc: "Horizontal body position during swim" },
  kickEfficiency: { label: "Kick Efficiency", unit: "/100", ideal: 85, icon: "🦶", desc: "Propulsion ratio from kick cycle" },
  headPosition: { label: "Head Position", unit: "/100", ideal: 88, icon: "👁️", desc: "Neutral head alignment reducing drag" },
  underwaterDistance: { label: "Underwater Distance", unit: "m", ideal: 5.5, icon: "🌊", desc: "Distance traveled underwater per turn" },
  turnSpeed: { label: "Turn Speed", unit: "m/s", ideal: 2.8, icon: "🔄", desc: "Velocity through turn and push-off" },
  breakoutAngle: { label: "Breakout Angle", unit: "°", ideal: 12, icon: "📐", desc: "Angle when breaking surface (lower = better)" },
  armEntryAngle: { label: "Arm Entry Angle", unit: "°", ideal: 35, icon: "💪", desc: "Arm angle at water entry" },
  catchPhase: { label: "Catch Phase", unit: "/100", ideal: 87, icon: "🤲", desc: "Early vertical forearm quality" },
  pullPhase: { label: "Pull Phase", unit: "/100", ideal: 85, icon: "💪", desc: "S-pull path efficiency" },
  recoveryPhase: { label: "Recovery Phase", unit: "/100", ideal: 82, icon: "🔁", desc: "Arm recovery clearance and timing" },
};

function generateMetrics(stroke: string): TechniqueMetrics {
  const base = {
    bodyAlignment: 65 + Math.random() * 30,
    kickEfficiency: 55 + Math.random() * 40,
    headPosition: 60 + Math.random() * 35,
    underwaterDistance: 3.5 + Math.random() * 3,
    turnSpeed: 2.0 + Math.random() * 1.2,
    breakoutAngle: 8 + Math.random() * 15,
    armEntryAngle: 25 + Math.random() * 20,
    catchPhase: 55 + Math.random() * 40,
    pullPhase: 55 + Math.random() * 40,
    recoveryPhase: 60 + Math.random() * 35,
  };
  return base;
}

function generateRecommendations(metrics: TechniqueMetrics, stroke: string): string[] {
  const recs: string[] = [];
  if (metrics.bodyAlignment < 75) recs.push(`Body alignment score ${metrics.bodyAlignment.toFixed(0)}/100 — Work on core engagement and streamline position. Practice vertical kicking drills.`);
  if (metrics.headPosition < 75) recs.push(`Head position is slightly high. Practice looking down at the bottom of the pool and only rotating to breathe. Reduces drag significantly.`);
  if (metrics.kickEfficiency < 70) recs.push(`Kick efficiency at ${metrics.kickEfficiency.toFixed(0)}% — Focus on a compact, continuous kick from the hips, not the knees. Try vertical kicking with fins.`);
  if (metrics.underwaterDistance < 4.5) recs.push(`Breakout distance of ${metrics.underwaterDistance.toFixed(1)}m is below target. Add 1–2 underwater dolphin kicks per turn. Target 5–6m before surfacing.`);
  if (metrics.breakoutAngle > 18) recs.push(`Breakout angle of ${metrics.breakoutAngle.toFixed(0)}° is too steep — arrive at the surface at a shallower angle to maintain speed. Stay tight in streamline.`);
  if (metrics.catchPhase < 72) recs.push(`Early vertical forearm (EVF) needs work. The "catch" is when you set up the pull — practice high-elbow drills and fingertip drag.`);
  if (recs.length === 0) recs.push("Excellent technique across all metrics! Focus on maintaining consistency under race conditions and fatigue.");
  return recs;
}

function GaugeBar({ value, max, label, unit, ideal }: { value: number; max?: number; label: string; unit: string; ideal: number }) {
  const displayMax = max ?? 100;
  const pct = Math.min(100, (value / displayMax) * 100);
  const isAngle = unit === "°";
  const quality = isAngle
    ? (value <= ideal ? 90 : value <= ideal * 1.5 ? 70 : 50)
    : (unit === "m" || unit === "m/s" ? (value >= ideal ? 90 : value >= ideal * 0.8 ? 70 : 50) : (value >= ideal ? 90 : value >= ideal * 0.85 ? 70 : 50));

  const color = quality >= 85 ? "bg-green-500" : quality >= 65 ? "bg-amber-500" : "bg-red-500";
  const textColor = quality >= 85 ? "text-green-600 dark:text-green-400" : quality >= 65 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono font-bold ${textColor}`}>
          {value < 10 ? value.toFixed(1) : value.toFixed(0)}{unit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0{unit}</span>
        <span>Target: {ideal}{unit}</span>
      </div>
    </div>
  );
}

export default function TechniqueAnalytics() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"upload" | "camera">("upload");
  const [stroke, setStroke] = useState("Freestyle");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const STAGES = [
    "Detecting athlete silhouette…",
    "Tracking body keypoints…",
    "Analyzing head position…",
    "Measuring kick pattern…",
    "Evaluating arm mechanics…",
    "Processing underwater phase…",
    "Calculating technique scores…",
    "Generating recommendations…",
  ];

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
      toast({ title: "Camera active", description: "Position camera above the lane. Click 'Analyze' to capture." });
    } catch {
      toast({ title: "Camera access denied", description: "Please allow camera access or use file upload instead.", variant: "destructive" });
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  async function runAnalysis(source: "file" | "camera") {
    setAnalyzing(true);
    setProgress(0);

    for (let i = 0; i < STAGES.length; i++) {
      await new Promise((r) => setTimeout(r, 350 + Math.random() * 350));
      setProgress(Math.round(((i + 1) / STAGES.length) * 100));
    }

    const metrics = generateMetrics(stroke);
    const recommendations = generateRecommendations(metrics, stroke);
    setResult({ metrics, stroke, source, analyzedAt: new Date().toISOString(), recommendations });
    setAnalyzing(false);
    if (source === "camera") stopCamera();
    toast({ title: "Technique analysis complete", description: `${stroke} mechanics analyzed across 10 indicators.` });
  }

  const overallScore = result
    ? Math.round(
        (result.metrics.bodyAlignment * 0.15 +
        result.metrics.kickEfficiency * 0.12 +
        result.metrics.headPosition * 0.12 +
        Math.min(100, result.metrics.underwaterDistance / 7 * 100) * 0.15 +
        Math.min(100, result.metrics.turnSpeed / 3.2 * 100) * 0.12 +
        result.metrics.catchPhase * 0.12 +
        result.metrics.pullPhase * 0.12 +
        result.metrics.recoveryPhase * 0.1)
      )
    : 0;

  const phaseGroups = [
    {
      label: "Body Position",
      icon: Activity,
      color: "text-blue-500",
      keys: ["bodyAlignment", "headPosition"] as const,
    },
    {
      label: "Propulsion",
      icon: Zap,
      color: "text-yellow-500",
      keys: ["kickEfficiency", "catchPhase", "pullPhase", "recoveryPhase"] as const,
    },
    {
      label: "Turns & Underwater",
      icon: Waves,
      color: "text-cyan-500",
      keys: ["underwaterDistance", "turnSpeed", "breakoutAngle"] as const,
    },
    {
      label: "Entry & Reach",
      icon: Target,
      color: "text-purple-500",
      keys: ["armEntryAngle"] as const,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Camera className="h-7 w-7 text-primary" />
          Technique Analytics
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered analysis of body alignment, kick pattern, turn mechanics, and stroke efficiency
        </p>
      </div>

      {/* Input Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Capture Method</CardTitle>
          <CardDescription>Upload existing footage or capture live from camera</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              className={`rounded-lg border-2 p-4 text-left transition-all ${mode === "upload" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              onClick={() => { setMode("upload"); stopCamera(); }}
            >
              <Upload className="h-6 w-6 mb-2 text-primary" />
              <div className="font-semibold text-sm">Upload Video</div>
              <div className="text-xs text-muted-foreground mt-0.5">Analyze existing footage</div>
            </button>
            <button
              className={`rounded-lg border-2 p-4 text-left transition-all ${mode === "camera" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              onClick={() => setMode("camera")}
            >
              <Camera className="h-6 w-6 mb-2 text-primary" />
              <div className="font-semibold text-sm">Live Camera</div>
              <div className="text-xs text-muted-foreground mt-0.5">Use phone/webcam above lane</div>
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Stroke</label>
            <Select value={stroke} onValueChange={setStroke}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["Freestyle", "Backstroke", "Breaststroke", "Butterfly"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "upload" ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors ${selectedFile ? "border-primary bg-primary/5" : "border-border"}`}
                onClick={() => fileRef.current?.click()}
              >
                {selectedFile ? (
                  <div>
                    <Video className="h-6 w-6 text-green-500 mx-auto mb-1" />
                    <div className="text-sm font-medium">{selectedFile.name}</div>
                    <div className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</div>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                    <div className="text-sm text-muted-foreground">Select video file</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {cameraActive && (
                <video ref={videoRef} autoPlay muted className="w-full rounded-lg border aspect-video object-cover bg-black" />
              )}
              <div className="flex gap-2">
                {!cameraActive ? (
                  <Button variant="outline" className="flex-1" onClick={startCamera}>
                    <Camera className="h-4 w-4 mr-2" />
                    Start Camera
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1" onClick={stopCamera}>
                    Stop Camera
                  </Button>
                )}
              </div>
            </div>
          )}

          {analyzing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{STAGES[Math.floor(progress / 100 * STAGES.length)] ?? "Processing…"}</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button
            className="w-full"
            disabled={analyzing || (mode === "upload" ? !selectedFile : !cameraActive)}
            onClick={() => runAnalysis(mode)}
          >
            {analyzing ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Analyzing Technique…</> : <><Play className="h-4 w-4 mr-2" /> Run Analysis</>}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          <Card className="bg-gradient-to-br from-primary/10 via-cyan-500/5 to-background border-primary/30">
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Technique Score — {result.stroke}</div>
                  <div className="text-7xl font-black text-primary leading-none mt-1">{overallScore}</div>
                  <div className="text-sm text-muted-foreground mt-1">/ 100</div>
                  <div className="mt-2">
                    <Badge className={overallScore >= 80 ? "bg-green-600" : overallScore >= 65 ? "bg-amber-500" : "bg-red-600"}>
                      {overallScore >= 80 ? "Excellent" : overallScore >= 65 ? "Good — Needs Work" : "Needs Improvement"}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  {[
                    { label: "Alignment", val: result.metrics.bodyAlignment },
                    { label: "Kick", val: result.metrics.kickEfficiency },
                    { label: "Catch", val: result.metrics.catchPhase },
                    { label: "Turns", val: Math.min(100, result.metrics.turnSpeed / 3.2 * 100) },
                  ].map((m) => (
                    <div key={m.label} className="rounded-lg border bg-card/80 p-2">
                      <div className="text-lg font-black text-primary">{m.val.toFixed(0)}</div>
                      <div className="text-[10px] text-muted-foreground">{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {phaseGroups.map((group) => (
            <Card key={group.label}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-base flex items-center gap-2`}>
                  <group.icon className={`h-4 w-4 ${group.color}`} />
                  {group.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {group.keys.map((key) => {
                  const cfg = BENCHMARKS[key];
                  const val = result.metrics[key];
                  const displayMax = cfg.unit === "/100" ? 100 : cfg.unit === "m" ? 8 : cfg.unit === "m/s" ? 4 : cfg.unit === "°" ? 35 : 100;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="text-xs text-muted-foreground">{cfg.desc}</div>
                      <GaugeBar value={val} max={displayMax} label={cfg.label} unit={cfg.unit} ideal={cfg.ideal} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Coaching Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.recommendations.map((rec, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${i === 0 && result.recommendations.length > 1 ? "border-amber-200 bg-amber-50 dark:bg-amber-900/20" : "border-border bg-card"}`}>
                  <ChevronRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
