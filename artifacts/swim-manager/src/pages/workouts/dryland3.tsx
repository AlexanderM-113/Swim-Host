import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Clock, Dumbbell, Flame, Target } from "lucide-react";

interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  duration?: string;
  rest?: string;
  notes?: string;
}

interface WorkoutBlock {
  block: string;
  duration: string;
  color: string;
  exercises: Exercise[];
}

interface DryLandWorkout {
  week: number;
  theme: string;
  focus: string;
  totalTime: string;
  intensity: "Low" | "Moderate" | "High";
  description: string;
  blocks: WorkoutBlock[];
}

const INTENSITY_COLOR: Record<string, string> = {
  Low: "bg-green-500/20 text-green-400 border-green-500/30",
  Moderate: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  High: "bg-red-500/20 text-red-400 border-red-500/30",
};

export const IN_SEASON_WORKOUTS: DryLandWorkout[] = [
  {
    week: 1,
    theme: "Re-Establish Patterns",
    focus: "Movement Quality Check",
    totalTime: "25 min",
    intensity: "Low",
    description: "The first in-season week is about greasing the groove, not gaining fitness. Swimmers are back in the water — dry land keeps the body balanced and healthy.",
    blocks: [
      {
        block: "Mobility Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Cat-Cow", reps: "10 slow" },
          { name: "Hip 90/90 Switch", reps: "8 each side" },
          { name: "Shoulder CARS", reps: "5 each shoulder" },
          { name: "Ankle Circles", reps: "10 each direction" },
        ],
      },
      {
        block: "Movement Pattern Reset",
        duration: "12 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Bodyweight Squat (slow)", sets: 3, reps: "10", rest: "30 sec", notes: "3 sec down, pause at bottom, stand" },
          { name: "Push-Up (full ROM)", sets: 3, reps: "8", rest: "30 sec", notes: "Chest to floor — reassess shoulder health" },
          { name: "Dead Bug", sets: 3, reps: "8 each side", rest: "25 sec" },
          { name: "Glute Bridge", sets: 3, reps: "12", rest: "25 sec", notes: "2-sec pause at top" },
        ],
      },
      {
        block: "Stretching & Recovery",
        duration: "8 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Hip Flexor Stretch", duration: "50 sec each side" },
          { name: "Overhead Lat Stretch", duration: "40 sec each" },
          { name: "Supine Spinal Twist", duration: "40 sec each side" },
          { name: "Child's Pose", duration: "1 min" },
        ],
      },
    ],
  },
  {
    week: 2,
    theme: "Stability & Swim Strength",
    focus: "Shoulder & Hip Resilience",
    totalTime: "25 min",
    intensity: "Moderate",
    description: "In-season shoulder health is the #1 priority. This week combines rotator cuff maintenance with hip stability work that prevents the knee injuries common in kick-heavy training blocks.",
    blocks: [
      {
        block: "Activation",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Band Pull-Aparts", reps: "15 × 3" },
          { name: "Clamshells (band or bodyweight)", sets: 2, reps: "15 each", rest: "15 sec" },
          { name: "Wall Slides", reps: "10 × 2" },
        ],
      },
      {
        block: "Stability Circuit",
        duration: "14 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Single-Leg Romanian Deadlift", sets: 3, reps: "10 each leg", rest: "30 sec", notes: "Hold dumbbells or bodyweight — maintain neutral spine" },
          { name: "TRX or Table Row", sets: 3, reps: "12", rest: "30 sec" },
          { name: "Side-Lying External Rotation", sets: 3, reps: "15 each", rest: "20 sec", notes: "Light weight — slow and controlled" },
          { name: "Copenhagen Plank", sets: 3, duration: "20 sec each side", rest: "25 sec", notes: "Adductor strength — knee health" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "6 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Pigeon Pose", duration: "50 sec each side" },
          { name: "Doorway Chest Stretch", duration: "40 sec each" },
          { name: "Wrist Flexor / Extensor Stretch", duration: "30 sec each side" },
        ],
      },
    ],
  },
  {
    week: 3,
    theme: "Maintain & Manage",
    focus: "Load Management Mid-Season",
    totalTime: "25 min",
    intensity: "Moderate",
    description: "Mid-season dry land walks a fine line: enough stimulus to retain off-season gains, not enough to create fatigue that hurts pool performance. This week is intentionally manageable.",
    blocks: [
      {
        block: "Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Jump Rope or Jumping Jacks", duration: "1 min" },
          { name: "World's Greatest Stretch", reps: "5 each side" },
          { name: "Inchworm", reps: "5" },
        ],
      },
      {
        block: "Full-Body Maintenance Circuit",
        duration: "14 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Goblet Squat (light-moderate weight)", sets: 3, reps: "10", rest: "35 sec" },
          { name: "Dumbbell Row", sets: 3, reps: "10 each", rest: "35 sec" },
          { name: "Reverse Lunge", sets: 3, reps: "10 each", rest: "30 sec" },
          { name: "Plank Shoulder Tap", sets: 3, reps: "10 each side", rest: "25 sec" },
          { name: "Band Lat Pull-Down (or towel sub)", sets: 3, reps: "12", rest: "30 sec" },
        ],
      },
      {
        block: "Flexibility Focus",
        duration: "6 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Thoracic Rotation Stretch", reps: "8 each side, slow" },
          { name: "Figure-Four Stretch", duration: "40 sec each side" },
          { name: "Standing Calf Stretch", duration: "30 sec each" },
          { name: "Deep Breathing", duration: "1 min" },
        ],
      },
    ],
  },
  {
    week: 4,
    theme: "Core Integration",
    focus: "Anti-Rotation & Streamline Strength",
    totalTime: "25 min",
    intensity: "Moderate",
    description: "A strong core in the streamline position is worth free yardage in every lap. This week focuses on anti-rotation, which directly translates to a tighter, faster streamline off every wall.",
    blocks: [
      {
        block: "Core Warm-Up",
        duration: "4 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Hollow Body Hold", sets: 3, duration: "15 sec", rest: "15 sec", notes: "Flatten low back to floor" },
          { name: "Cat-Cow into Thread the Needle", reps: "8 each side" },
        ],
      },
      {
        block: "Anti-Rotation Block",
        duration: "13 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Pallof Press", sets: 3, reps: "12 each side", rest: "30 sec", notes: "2-sec hold at extension — resist rotation" },
          { name: "Side Plank", sets: 3, duration: "25 sec each side", rest: "20 sec" },
          { name: "Dead Bug (slow + arms only)", sets: 3, reps: "10 each side", rest: "25 sec" },
          { name: "Tall Kneeling Band Chop (high to low)", sets: 3, reps: "10 each side", rest: "25 sec" },
        ],
      },
      {
        block: "Mobility Cool-Down",
        duration: "8 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Supine Spinal Twist", duration: "45 sec each side" },
          { name: "Hip Flexor Stretch", duration: "45 sec each side" },
          { name: "Overhead Streamline Stretch (against wall)", duration: "45 sec", notes: "Arms overhead, hands together — simulate streamline" },
        ],
      },
    ],
  },
  {
    week: 5,
    theme: "Pre-Championship Boost",
    focus: "Activation Without Fatigue",
    totalTime: "20 min",
    intensity: "Moderate",
    description: "4 weeks from a target meet — keep the muscle systems primed without adding fatigue. Short, focused, and confidence-building.",
    blocks: [
      {
        block: "Activation",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Mini-Band Walk (lateral)", duration: "10m × 3" },
          { name: "Band Pull-Aparts", reps: "15 × 2" },
          { name: "Skater Bounds", reps: "6 each side" },
        ],
      },
      {
        block: "Priming Circuit",
        duration: "10 min",
        color: "border-l-amber-500",
        exercises: [
          { name: "Jump Squat (bodyweight)", sets: 3, reps: "5", rest: "45 sec", notes: "Sub-max — 80% effort" },
          { name: "Explosive Row (band)", sets: 3, reps: "6 each arm", rest: "40 sec" },
          { name: "Broad Jump × 3 in series", sets: 3, rest: "45 sec" },
        ],
      },
      {
        block: "Stretch",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Hip Flexor Stretch", duration: "40 sec each" },
          { name: "Shoulder Cross-Body Stretch", duration: "30 sec each" },
          { name: "Ankle Circles + Calf Raise × 10", duration: "30 sec" },
        ],
      },
    ],
  },
  {
    week: 6,
    theme: "Injury Prevention Block",
    focus: "Prehab & Longevity",
    totalTime: "20 min",
    intensity: "Low",
    description: "Late-season prehab protects the gains made all year. Swimmers' shoulders, knees, and ankles all need love. A single injury in week 6 is catastrophic — this session prevents that.",
    blocks: [
      {
        block: "Joint Mobility",
        duration: "6 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Shoulder CARS", reps: "5 each shoulder, slow" },
          { name: "Hip CARS", reps: "5 each hip" },
          { name: "Ankle Alphabet", duration: "Draw A-Z each ankle" },
          { name: "Thoracic Extensions over foam roller", duration: "1 min" },
        ],
      },
      {
        block: "Prehab Maintenance",
        duration: "9 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Rotator Cuff External Rotation (band)", sets: 3, reps: "20 each", rest: "20 sec", notes: "Very light — focus on form and full ROM" },
          { name: "Clamshell", sets: 3, reps: "20 each", rest: "20 sec" },
          { name: "Side-Lying Hip Abduction", sets: 3, reps: "20 each", rest: "20 sec" },
          { name: "Terminal Knee Extension (TKE)", sets: 3, reps: "15 each", rest: "20 sec", notes: "VMO activation — knee health" },
        ],
      },
      {
        block: "Deep Stretch",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Pigeon Pose", duration: "60 sec each side" },
          { name: "Overhead Lat Stretch", duration: "45 sec each" },
          { name: "Child's Pose with Side Reach", duration: "30 sec each side" },
        ],
      },
    ],
  },
  {
    week: 7,
    theme: "Championship Taper",
    focus: "Stay Loose, Stay Ready",
    totalTime: "15 min",
    intensity: "Low",
    description: "Championship week. The work is done. Dry land is just maintenance — keep the body warm, joints mobile, and muscles activated. Under 15 minutes. Leave feeling good.",
    blocks: [
      {
        block: "Easy Movement",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Arm Swings + Leg Swings", duration: "1 min" },
          { name: "Hip Circle", reps: "10 each direction" },
          { name: "Easy skip", duration: "20m x2" },
        ],
      },
      {
        block: "Light Activation (Feel Good Only)",
        duration: "7 min",
        color: "border-l-green-500",
        exercises: [
          { name: "Glute Bridge", sets: 2, reps: "10", rest: "20 sec", notes: "Just waking up the posterior chain" },
          { name: "Band Pull-Apart", sets: 2, reps: "12", rest: "15 sec" },
          { name: "3 Broad Jumps (easy, ~60% effort)", sets: 1, rest: "open" },
        ],
      },
      {
        block: "Full-Body Stretch",
        duration: "3 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Hip Flexor Stretch", duration: "30 sec each" },
          { name: "Cross-Body Shoulder Stretch", duration: "30 sec each" },
          { name: "Standing Forward Fold", duration: "30 sec" },
        ],
      },
    ],
  },
];

function ExerciseRow({ ex }: { ex: Exercise }) {
  return (
    <div className="flex items-start gap-2 py-0.5 text-xs">
      <span className="h-1.5 w-1.5 rounded-full bg-primary/50 mt-1.5 flex-shrink-0" />
      <span className="font-medium min-w-0">{ex.name}</span>
      {(ex.sets || ex.reps || ex.duration) && (
        <span className="text-muted-foreground ml-auto shrink-0">
          {ex.sets && `${ex.sets}×`}{ex.reps}{ex.duration && ` ${ex.duration}`}
          {ex.rest && <span className="text-cyan-600/70 ml-1">({ex.rest})</span>}
        </span>
      )}
      {ex.notes && <span className="text-muted-foreground/70 italic text-[10px] mt-0.5 block">{ex.notes}</span>}
    </div>
  );
}

function WorkoutCard({ workout }: { workout: DryLandWorkout }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className={cn("transition-all", open ? "ring-1 ring-primary/30" : "")}>
      <button type="button" className="w-full text-left" onClick={() => setOpen((v) => !v)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-lg shrink-0">
                {workout.week}
              </div>
              <div>
                <CardTitle className="text-base leading-tight">Week {workout.week} — {workout.theme}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{workout.focus}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={cn("text-[10px] border", INTENSITY_COLOR[workout.intensity])}>
                <Flame className="h-2.5 w-2.5 mr-1" />{workout.intensity}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                <Clock className="h-2.5 w-2.5 mr-1" />{workout.totalTime}
              </Badge>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-left">{workout.description}</p>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="pt-0 space-y-4">
          {workout.blocks.map((block) => (
            <div key={block.block} className={cn("border-l-4 pl-3 space-y-1", block.color)}>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{block.block}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />{block.duration}
                </span>
              </div>
              <div>{block.exercises.map((ex, i) => <ExerciseRow key={i} ex={ex} />)}</div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default function InSeasonMaintenanceProgram() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-green-500" />
          In-Season Maintenance Program
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          7-week in-season program — designed to maintain strength, prevent injury, and peak for championship meets
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-primary">7</div>
          <div className="text-xs text-muted-foreground">Weeks</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-primary">25</div>
          <div className="text-xs text-muted-foreground">Min / Session</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-green-500">Managed</div>
          <div className="text-xs text-muted-foreground">Load</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-cyan-500">In-Season</div>
          <div className="text-xs text-muted-foreground">Phase</div>
        </div>
      </div>

      <div className="space-y-3">
        {IN_SEASON_WORKOUTS.map((w) => <WorkoutCard key={w.week} workout={w} />)}
      </div>
      <p className="text-xs text-muted-foreground text-center pt-2">
        Designed to run alongside your pool training. Keep volume low — pool practice is the priority.
      </p>
    </div>
  );
}
