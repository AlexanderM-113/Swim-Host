import { useState } from "react";
import { Link } from "wouter";
import { useGetMeet } from "@/lib/local-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Circle, ArrowRight, Trophy, Users, Shuffle,
  Timer, FileInput, Medal, List, RefreshCw, Lock, Star
} from "lucide-react";
import { cn } from "@/lib/utils";

const PHASE_KEY = (meetId: number) => `swimmanager_meet_phase_${meetId}`;

type Phase = "prelims" | "between" | "finals" | "complete";

interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  action?: string;
}

const PRELIMS_STEPS: WorkflowStep[] = [
  { id: "accept", label: "Accept Entries", description: "Review and accept all athlete entries for prelim events.", icon: Users, href: "athletes" },
  { id: "seed", label: "Seed Prelims", description: "Assign athletes to heats and lanes based on seed times.", icon: Shuffle, href: "seeding" },
  { id: "run-prelims", label: "Run Prelim Heats", description: "Execute each prelim heat and record finish times.", icon: Timer, href: "run" },
  { id: "import", label: "Import Times", description: "Import official results from timing system or enter manually.", icon: FileInput, href: "run" },
  { id: "rank", label: "Rank Finalists", description: "Review prelim results and generate the finals heat sheet.", icon: Medal, href: "run" },
  { id: "generate", label: "Generate Finalists", description: "Confirm finalist list and prepare for finals session.", icon: List, href: "seeding" },
];

const BETWEEN_STEPS: WorkflowStep[] = [
  { id: "scratches", label: "Handle Scratches", description: "Process any scratches from athletes who won't compete in finals.", icon: RefreshCw, href: "athletes" },
  { id: "alternates", label: "Promote Alternates", description: "Move alternates into vacated spots per competition rules.", icon: ArrowRight, href: "athletes" },
  { id: "lock", label: "Lock Finalists", description: "Freeze the finals heat sheet — no more changes.", icon: Lock, action: "lock" },
  { id: "reseed", label: "Re-Seed Finals", description: "Generate final lane assignments (circle seeding for championship).", icon: Shuffle, href: "seeding" },
];

const FINALS_STEPS: WorkflowStep[] = [
  { id: "run-finals", label: "Run Final Heats", description: "Execute each final heat and record finish times.", icon: Timer, href: "run" },
  { id: "import-finals", label: "Import Final Times", description: "Import official results from timing system.", icon: FileInput, href: "run" },
  { id: "score", label: "Score Meet", description: "Calculate team scores and individual placements.", icon: Trophy, href: "scores" },
  { id: "publish", label: "Publish Results", description: "Mark results as official and generate final reports.", icon: Star, href: "run" },
  { id: "export", label: "Export Results", description: "Export results as SD3 file for official submission.", icon: FileInput, href: "/sdif" },
];

function StepItem({
  step, done, active, meetId, tabBase,
}: {
  step: WorkflowStep;
  done: boolean;
  active: boolean;
  meetId: number;
  tabBase: string;
}) {
  const Icon = step.icon;
  const href = step.href
    ? step.href.startsWith("/")
      ? step.href
      : `${tabBase}/${step.href}`
    : undefined;

  return (
    <div className={cn(
      "flex items-start gap-4 p-4 rounded-lg border transition-all",
      done
        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 opacity-70"
        : active
          ? "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700 shadow-sm"
          : "bg-muted/30 border-border"
    )}>
      <div className={cn(
        "mt-0.5 shrink-0 rounded-full p-1.5",
        done ? "bg-emerald-500" : active ? "bg-cyan-500" : "bg-muted-foreground/20"
      )}>
        {done
          ? <CheckCircle2 className="h-4 w-4 text-white" />
          : <Icon className={cn("h-4 w-4", active ? "text-white" : "text-muted-foreground")} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("font-semibold text-sm", done && "line-through text-muted-foreground")}>
            {step.label}
          </span>
          {active && <Badge className="bg-cyan-500 text-white text-[10px]">Current</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
      </div>
      {href && !done && (
        <Link href={href}>
          <Button size="sm" variant={active ? "default" : "outline"} className="shrink-0">
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function PhaseSection({
  title, badge, badgeClass, steps, completedSteps, currentPhase, phaseKey, meetId, tabBase,
}: {
  title: string;
  badge: string;
  badgeClass: string;
  steps: WorkflowStep[];
  completedSteps: Set<string>;
  currentPhase: Phase;
  phaseKey: Phase;
  meetId: number;
  tabBase: string;
}) {
  const isCurrentPhase = currentPhase === phaseKey;
  const phaseOrder: Phase[] = ["prelims", "between", "finals", "complete"];
  const isDone = phaseOrder.indexOf(currentPhase) > phaseOrder.indexOf(phaseKey);
  const firstUndone = steps.find(s => !completedSteps.has(s.id));

  return (
    <Card className={cn(
      "border-2 transition-all",
      isDone && "opacity-60",
      isCurrentPhase && "border-cyan-400 dark:border-cyan-600 shadow-md"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge className={badgeClass}>{badge}</Badge>
          {isDone && <Badge variant="outline" className="text-emerald-600 border-emerald-400">Complete</Badge>}
          {isCurrentPhase && <Badge variant="outline" className="text-cyan-600 border-cyan-400 animate-pulse">Active</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, idx) => {
          const done = completedSteps.has(step.id);
          const active = isCurrentPhase && !done && step.id === firstUndone?.id;
          return (
            <StepItem
              key={step.id}
              step={step}
              done={done}
              active={active}
              meetId={meetId}
              tabBase={tabBase}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function MeetWorkflow({ meetId }: { meetId: number }) {
  const { data: meet } = useGetMeet(meetId);
  const tabBase = `/meets/${meetId}`;

  const [phase, setPhaseState] = useState<Phase>(() => {
    const stored = localStorage.getItem(PHASE_KEY(meetId));
    return (stored as Phase) ?? "prelims";
  });

  const [completedSteps, setCompletedSteps] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(`${PHASE_KEY(meetId)}_steps`);
    try { return new Set(stored ? JSON.parse(stored) : []); } catch { return new Set(); }
  });

  function setPhase(p: Phase) {
    setPhaseState(p);
    localStorage.setItem(PHASE_KEY(meetId), p);
  }

  function toggleStep(id: string) {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(`${PHASE_KEY(meetId)}_steps`, JSON.stringify([...next]));
      return next;
    });
  }

  const allPrelimsComplete = PRELIMS_STEPS.every(s => completedSteps.has(s.id));
  const allBetweenComplete = BETWEEN_STEPS.every(s => completedSteps.has(s.id));
  const allFinalsComplete = FINALS_STEPS.every(s => completedSteps.has(s.id));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-cyan-500" />
            Prelim/Final Workflow
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Step-by-step guide for running a prelim/final championship meet. Mark each step complete as you go.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(["prelims", "between", "finals"] as Phase[]).map(p => (
            <Button
              key={p}
              size="sm"
              variant={phase === p ? "default" : "outline"}
              onClick={() => setPhase(p)}
              className="capitalize"
            >
              {p === "between" ? "Between Sessions" : p.charAt(0).toUpperCase() + p.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <PhaseSection
          title="Phase 1: Prelims"
          badge="Session 1"
          badgeClass="bg-blue-600 text-white"
          steps={PRELIMS_STEPS}
          completedSteps={completedSteps}
          currentPhase={phase}
          phaseKey="prelims"
          meetId={meetId}
          tabBase={tabBase}
        />

        {allPrelimsComplete && phase === "prelims" && (
          <div className="flex justify-center">
            <Button onClick={() => setPhase("between")} className="gap-2">
              <ArrowRight className="h-4 w-4" /> Advance to Between Sessions
            </Button>
          </div>
        )}

        <PhaseSection
          title="Phase 2: Between Sessions"
          badge="Intermission"
          badgeClass="bg-amber-600 text-white"
          steps={BETWEEN_STEPS}
          completedSteps={completedSteps}
          currentPhase={phase}
          phaseKey="between"
          meetId={meetId}
          tabBase={tabBase}
        />

        {allBetweenComplete && phase === "between" && (
          <div className="flex justify-center">
            <Button onClick={() => setPhase("finals")} className="gap-2">
              <ArrowRight className="h-4 w-4" /> Advance to Finals
            </Button>
          </div>
        )}

        <PhaseSection
          title="Phase 3: Finals"
          badge="Championship Round"
          badgeClass="bg-emerald-600 text-white"
          steps={FINALS_STEPS}
          completedSteps={completedSteps}
          currentPhase={phase}
          phaseKey="finals"
          meetId={meetId}
          tabBase={tabBase}
        />
      </div>

      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3 font-semibold uppercase tracking-wide">Mark Steps Complete</p>
          <div className="flex flex-wrap gap-2">
            {[...PRELIMS_STEPS, ...BETWEEN_STEPS, ...FINALS_STEPS].map(step => (
              <button
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className={cn(
                  "text-xs px-2.5 py-1 rounded-full border transition-all",
                  completedSteps.has(step.id)
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "bg-background border-border text-muted-foreground hover:border-primary"
                )}
              >
                {completedSteps.has(step.id) ? "✓ " : ""}{step.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
