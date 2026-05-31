import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Video, Upload, Play, BarChart3, Timer, Waves, TrendingUp,
  TrendingDown, AlertCircle, CheckCircle, RefreshCw, Download,
  Zap, Target, RotateCcw, Layers
} from "lucide-react";

interface RaceMetrics {
  reactionTime: number;
  splitTimes: number[];
  strokeRate: number;
  strokeCount: number;
  turnTime: number;
  breakoutDistance: number;
  underwaterKicks: number;
  finishTime: number;
  breakoutTime: number;
  turns: { lap: number; time: number; efficiency: number }[];
}

interface VideoAnalysis {
  filename: string;
  duration: number;
  stroke: string;
  distance: number;
  course: string;
  metrics: RaceMetrics;
  analyzedAt: string;
}

function generateSimulatedAnalysis(stroke: string, distance: number): RaceMetrics {
  const base = stroke === "Freestyle" ? 14 : stroke === "Backstroke" ? 17 : stroke === "Breaststroke" ? 22 : 15;
  const laps = distance / (distance <= 50 ? 50 : 50);
  const numLaps = distance / 50;

  return {
    reactionTime: 0.60 + Math.random() * 0.25,
    splitTimes: Array.from({ length: Math.max(1, numLaps / 2) }, (_, i) =>
      base + i * 0.3 + (Math.random() - 0.5) * 1.5
    ),
    strokeRate: 35 + Math.random() * 15,
    strokeCount: Math.floor(12 + Math.random() * 8),
    turnTime: 0.65 + Math.random() * 0.4,
    breakoutDistance: 3.5 + Math.random() * 1.5,
    underwaterKicks: Math.floor(3 + Math.random() * 4),
    finishTime: base * (numLaps || 1) + Math.random() * 2,
    breakoutTime: 1.2 + Math.random() * 0.6,
    turns: Array.from({ length: Math.max(0, Math.floor(numLaps) - 1) }, (_, i) => ({
      lap: i + 1,
      time: 0.65 + Math.random() * 0.4,
      efficiency: 70 + Math.random() * 25,
    })),
  };
}

function MetricRow({ label, value, unit, benchmark, icon: Icon, better = "lower" }: {
  label: string; value: string | number; unit?: string;
  benchmark?: number; icon?: React.ComponentType<{ className?: string }>; better?: "lower" | "higher"
}) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  const comparison = benchmark
    ? (better === "lower" ? (num < benchmark ? "good" : num < benchmark * 1.1 ? "ok" : "bad") : (num > benchmark ? "good" : num > benchmark * 0.9 ? "ok" : "bad"))
    : null;

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono font-bold">
          {typeof value === "number" ? value.toFixed(value < 10 ? 2 : 1) : value}
          {unit && <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>}
        </span>
        {comparison === "good" && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
        {comparison === "ok" && <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
        {comparison === "bad" && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
      </div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-bold font-mono">{score.toFixed(0)}/100</span>
      </div>
      <Progress value={score} className="h-2" />
    </div>
  );
}

export default function VideoAnalysis() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [stroke, setStroke] = useState("Freestyle");
  const [distance, setDistance] = useState("100");
  const [course, setCourse] = useState("SCY");
  const [compareMode, setCompareMode] = useState(false);
  const [history, setHistory] = useState<VideoAnalysis[]>([]);

  const STAGES = [
    "Loading video frames…",
    "Detecting athlete…",
    "Tracking body position…",
    "Analyzing start reaction…",
    "Measuring stroke mechanics…",
    "Processing turns…",
    "Calculating split times…",
    "Generating report…",
  ];

  async function analyzeVideo() {
    if (!selectedFile) return;
    setAnalyzing(true);
    setProgress(0);

    for (let i = 0; i < STAGES.length; i++) {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
      setProgress(Math.round(((i + 1) / STAGES.length) * 100));
    }

    const metrics = generateSimulatedAnalysis(stroke, parseInt(distance));
    const result: VideoAnalysis = {
      filename: selectedFile.name,
      duration: Math.random() * 120 + 30,
      stroke,
      distance: parseInt(distance),
      course,
      metrics,
      analyzedAt: new Date().toISOString(),
    };

    setAnalysis(result);
    setHistory((prev) => [result, ...prev].slice(0, 10));
    setAnalyzing(false);
    toast({ title: "Analysis complete", description: `${stroke} ${distance}m — race metrics extracted.` });
  }

  const overallScore = analysis
    ? Math.round(
        (Math.min(100, 100 - (analysis.metrics.reactionTime - 0.65) * 100)) * 0.15 +
        (Math.min(100, (analysis.metrics.breakoutDistance / 6) * 100)) * 0.2 +
        (Math.min(100, 100 - (analysis.metrics.turnTime - 0.65) * 80)) * 0.25 +
        (Math.min(100, analysis.metrics.strokeRate > 0 ? Math.min(analysis.metrics.strokeRate / 50 * 100, 100) : 50)) * 0.2 +
        (Math.min(100, analysis.metrics.underwaterKicks / 6 * 100)) * 0.2
      )
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Video className="h-7 w-7 text-primary" />
          Video Race Analysis
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload race footage for automatic detection of starts, turns, stroke mechanics, and splits
        </p>
      </div>

      {/* Upload & Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Race Video
          </CardTitle>
          <CardDescription>Supports MP4, MOV, AVI. Poolside footage works best.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors hover:border-primary/50 ${selectedFile ? "border-primary bg-primary/5" : "border-border"}`}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
            />
            {selectedFile ? (
              <div className="space-y-1">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto" />
                <div className="font-medium">{selectedFile.name}</div>
                <div className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</div>
              </div>
            ) : (
              <div className="space-y-2">
                <Video className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <div className="text-sm text-muted-foreground">Click to select video file</div>
                <div className="text-xs text-muted-foreground">MP4, MOV, AVI</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Stroke</label>
              <Select value={stroke} onValueChange={setStroke}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Freestyle", "Backstroke", "Breaststroke", "Butterfly", "IM"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Distance</label>
              <Select value={distance} onValueChange={setDistance}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["50", "100", "200", "400", "800", "1500"].map((d) => (
                    <SelectItem key={d} value={d}>{d}m</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Course</label>
              <Select value={course} onValueChange={setCourse}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SCY">SCY (25yd)</SelectItem>
                  <SelectItem value="SCM">SCM (25m)</SelectItem>
                  <SelectItem value="LCM">LCM (50m)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {analyzing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{STAGES[Math.floor(progress / 100 * STAGES.length)] ?? "Processing…"}</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          <Button onClick={analyzeVideo} disabled={!selectedFile || analyzing} className="w-full">
            {analyzing ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</>
            ) : (
              <><Play className="h-4 w-4 mr-2" /> Analyze Race</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {analysis && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Analysis Results — {analysis.stroke} {analysis.distance}m {analysis.course}
            </h2>
            <div className="flex items-center gap-2">
              <Badge className="text-xs">{new Date(analysis.analyzedAt).toLocaleTimeString()}</Badge>
              <Button size="sm" variant="outline">
                <Download className="h-3.5 w-3.5 mr-1" />
                Export PDF
              </Button>
            </div>
          </div>

          {/* Overall Score */}
          <Card className="bg-gradient-to-r from-primary/10 to-cyan-500/10 border-primary/30">
            <CardContent className="pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Overall Race Score</div>
                  <div className="text-6xl font-black text-primary mt-1">{overallScore}</div>
                  <div className="text-sm text-muted-foreground mt-1">out of 100</div>
                </div>
                <div className="space-y-2 w-56">
                  <ScoreBar label="Reaction" score={Math.min(100, 100 - (analysis.metrics.reactionTime - 0.65) * 100)} />
                  <ScoreBar label="Underwater" score={Math.min(100, (analysis.metrics.breakoutDistance / 6) * 100)} />
                  <ScoreBar label="Turns" score={Math.min(100, 100 - (analysis.metrics.turnTime - 0.65) * 80)} />
                  <ScoreBar label="Stroke" score={Math.min(100, analysis.metrics.strokeRate / 50 * 100)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Start & Reaction */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-500" /> Start & Entry</CardTitle>
              </CardHeader>
              <CardContent>
                <MetricRow label="Reaction Time" value={analysis.metrics.reactionTime} unit="s" benchmark={0.65} better="lower" icon={Timer} />
                <MetricRow label="Breakout Distance" value={analysis.metrics.breakoutDistance} unit="m" benchmark={5.5} better="higher" icon={Target} />
                <MetricRow label="Breakout Time" value={analysis.metrics.breakoutTime} unit="s" benchmark={1.4} better="lower" icon={Timer} />
                <MetricRow label="Underwater Kicks" value={analysis.metrics.underwaterKicks} unit="kicks" benchmark={4} better="higher" />
              </CardContent>
            </Card>

            {/* Stroke Mechanics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Waves className="h-4 w-4 text-blue-500" /> Stroke Mechanics</CardTitle>
              </CardHeader>
              <CardContent>
                <MetricRow label="Stroke Rate" value={analysis.metrics.strokeRate} unit="spm" benchmark={40} better="higher" />
                <MetricRow label="Stroke Count" value={analysis.metrics.strokeCount} unit="strokes" />
                <MetricRow label="Turn Time" value={analysis.metrics.turnTime} unit="s" benchmark={0.75} better="lower" icon={RotateCcw} />
              </CardContent>
            </Card>
          </div>

          {/* Turns */}
          {analysis.metrics.turns.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Turn Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {analysis.metrics.turns.map((turn) => (
                    <div key={turn.lap} className="rounded-lg border bg-card p-3 text-center">
                      <div className="text-xs text-muted-foreground">Turn {turn.lap}</div>
                      <div className="font-mono font-bold text-lg text-primary">{turn.time.toFixed(2)}s</div>
                      <div className={`text-xs font-semibold mt-1 ${turn.efficiency >= 85 ? "text-green-500" : turn.efficiency >= 70 ? "text-amber-500" : "text-red-500"}`}>
                        {turn.efficiency.toFixed(0)}% efficient
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Splits */}
          {analysis.metrics.splitTimes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Split Times</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 h-24 overflow-x-auto">
                  {analysis.metrics.splitTimes.map((split, i) => {
                    const max = Math.max(...analysis.metrics.splitTimes);
                    const min = Math.min(...analysis.metrics.splitTimes);
                    const range = max - min || 1;
                    const height = 20 + ((max - split) / range) * 80;
                    return (
                      <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0">
                        <div className="text-[10px] text-primary font-mono">{split.toFixed(1)}</div>
                        <div
                          className="w-10 rounded-t bg-primary/80 transition-all"
                          style={{ height: `${height}%` }}
                        />
                        <div className="text-[10px] text-muted-foreground">{(i + 1) * 50}m</div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> Improvement Recommendations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {analysis.metrics.reactionTime > 0.8 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <span><strong>Start:</strong> Reaction time of {analysis.metrics.reactionTime.toFixed(2)}s is above average. Work on block starts — focus on "take your marks" tension and explosive drive.</span>
                </div>
              )}
              {analysis.metrics.breakoutDistance < 4.5 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <span><strong>Underwater:</strong> Breakout distance of {analysis.metrics.breakoutDistance.toFixed(1)}m is short. Increase dolphin kicks and extend streamline. Elite swimmers target 5–7m.</span>
                </div>
              )}
              {analysis.metrics.turnTime > 0.9 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <span><strong>Turns:</strong> Turn time of {analysis.metrics.turnTime.toFixed(2)}s needs improvement. Focus on tight tucks, faster rotation, and immediate push-off.</span>
                </div>
              )}
              {analysis.metrics.reactionTime <= 0.8 && analysis.metrics.breakoutDistance >= 4.5 && analysis.metrics.turnTime <= 0.9 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span><strong>Great mechanics!</strong> All key indicators are within target range. Focus on maintaining consistency across all heats.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* History */}
      {history.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> Analysis History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b last:border-0 cursor-pointer hover:bg-muted/30 rounded px-2 transition-colors"
                  onClick={() => setAnalysis(h)}
                >
                  <div>
                    <span className="font-medium text-sm">{h.stroke} {h.distance}m {h.course}</span>
                    <div className="text-xs text-muted-foreground">{h.filename}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{new Date(h.analyzedAt).toLocaleTimeString()}</span>
                    {i === 0 && <Badge variant="secondary" className="text-[10px]">Latest</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
