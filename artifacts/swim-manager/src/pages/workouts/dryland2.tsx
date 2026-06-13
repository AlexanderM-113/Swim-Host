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

export const SPRINT_POWER_WORKOUTS: DryLandWorkout[] = [
  {
    week: 1,
    theme: "Explosive Foundation",
    focus: "Fast-Twitch Activation",
    totalTime: "30 min",
    intensity: "Moderate",
    description: "Introduce the nervous system to explosive movement. Sprint swimmers need rapid fiber recruitment — these sessions prime the body for speed work ahead.",
    blocks: [
      {
        block: "CNS Warm-Up",
        duration: "6 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "High Knees", duration: "20 sec on / 10 sec off × 4" },
          { name: "Ankle Pops (in place)", duration: "20 sec × 3", notes: "Stay on balls of feet, ultra-fast contact" },
          { name: "Arm Circles Accelerating", duration: "30 sec", notes: "Slow to fast — prime shoulder joint" },
          { name: "Hip Flexor March", reps: "10 each leg" },
        ],
      },
      {
        block: "Speed-Strength Circuit A",
        duration: "12 min",
        color: "border-l-red-500",
        exercises: [
          { name: "Jump Squat", sets: 4, reps: "5", rest: "60 sec", notes: "Maximal effort every rep — full reset between sets" },
          { name: "Clap Push-Up (or fast push-up)", sets: 4, reps: "4", rest: "60 sec", notes: "Explosive chest drive — land soft" },
          { name: "Bounding (long jumps in series)", sets: 3, reps: "6 bounds", rest: "45 sec" },
        ],
      },
      {
        block: "Core Speed",
        duration: "7 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Dead Bug with Reach", sets: 3, reps: "8 each side", rest: "20 sec" },
          { name: "Hollow Body Flutter Kick", sets: 3, duration: "15 sec", rest: "20 sec", notes: "Simulate underwater kick position" },
          { name: "V-Up", sets: 3, reps: "10", rest: "20 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Standing Hip Flexor Stretch", duration: "40 sec each" },
          { name: "Doorway Chest Stretch", duration: "30 sec each side" },
          { name: "Slow neck & shoulder rolls", duration: "1 min" },
        ],
      },
    ],
  },
  {
    week: 2,
    theme: "Lower Body Power",
    focus: "Leg Drive & Starts",
    totalTime: "30 min",
    intensity: "High",
    description: "Leg power is the engine behind every start and turn. This week loads the quads, hamstrings, and glutes for maximum force production.",
    blocks: [
      {
        block: "Dynamic Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Walking Lunge with Rotation", reps: "10 each side" },
          { name: "Lateral Shuffle", duration: "20m x3" },
          { name: "A-Skip", duration: "20m x2" },
          { name: "Leg Swings (forward + lateral)", reps: "10 each direction per leg" },
        ],
      },
      {
        block: "Plyometric Leg Power",
        duration: "13 min",
        color: "border-l-red-500",
        exercises: [
          { name: "Depth Drop to Jump", sets: 4, reps: "5", rest: "60 sec", notes: "Step off 12-18\" box, land and immediately jump — minimize ground contact" },
          { name: "Single-Leg Hop (forward)", sets: 3, reps: "6 each leg", rest: "45 sec" },
          { name: "Lateral Bound", sets: 3, reps: "8 each side", rest: "40 sec", notes: "Stick landing — simulate underwater dolphin kick push" },
          { name: "Tuck Jump", sets: 3, reps: "6", rest: "45 sec" },
        ],
      },
      {
        block: "Strength Finisher",
        duration: "7 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Bulgarian Split Squat", sets: 3, reps: "8 each leg", rest: "40 sec", notes: "Rear foot elevated — drive through front heel" },
          { name: "Calf Raise (1.5 rep method)", sets: 3, reps: "10", rest: "30 sec", notes: "Up full, halfway down, back up, full down = 1 rep" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Quad Stretch", duration: "40 sec each" },
          { name: "Seated Hamstring Stretch", duration: "45 sec each" },
          { name: "Pigeon Pose", duration: "40 sec each side" },
        ],
      },
    ],
  },
  {
    week: 3,
    theme: "Upper Body Explosive",
    focus: "Pull Power & Stroke Strength",
    totalTime: "30 min",
    intensity: "High",
    description: "The pulling phase of freestyle and butterfly generates the most propulsion. This week targets the lats, biceps, and posterior deltoids for explosive water entry power.",
    blocks: [
      {
        block: "Upper Body Wake-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Band Pull-Aparts", reps: "15 × 3", rest: "15 sec" },
          { name: "Scapular Push-Ups", reps: "10 × 2" },
          { name: "Wall Slides", reps: "8 × 2", notes: "Maintain forearm contact with wall throughout" },
          { name: "Arm Swings (crossing)", duration: "30 sec" },
        ],
      },
      {
        block: "Explosive Pull Circuit",
        duration: "13 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Resistance Band Explosive Row", sets: 4, reps: "8", rest: "45 sec", notes: "Explode the pull phase, slow return — mimics freestyle catch" },
          { name: "Lat Pull-Down (fast concentric)", sets: 4, reps: "6", rest: "50 sec", notes: "Full ROM — feel the lat engagement at bottom" },
          { name: "Medicine Ball Chest Pass (wall)", sets: 3, reps: "8", rest: "30 sec" },
          { name: "TRX Row (or table row)", sets: 3, reps: "10", rest: "30 sec", notes: "Maintain plank body position" },
        ],
      },
      {
        block: "Shoulder Stability",
        duration: "7 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Prone Y-T-W", sets: 3, reps: "8 each", rest: "30 sec", notes: "Thumbs up for Y, palms down for T and W" },
          { name: "External Rotation (band)", sets: 3, reps: "15 each arm", rest: "20 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Overhead Lat Stretch (one arm)", duration: "40 sec each" },
          { name: "Chest Opener (hands clasped behind)", duration: "45 sec" },
          { name: "Thread the Needle", reps: "6 each side", notes: "Slow thoracic rotation" },
        ],
      },
    ],
  },
  {
    week: 4,
    theme: "Full-Body Speed",
    focus: "Transfer to Water",
    totalTime: "30 min",
    intensity: "High",
    description: "Combine upper and lower power in full-body patterns. These compound movements mimic the kinetic chain of a racing start — the biggest speed multiplier in swimming.",
    blocks: [
      {
        block: "Speed Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Skater Bounds", duration: "20 sec × 3", rest: "15 sec" },
          { name: "Sprint Starts (from push-up position)", reps: "6 × 10m", rest: "20 sec" },
          { name: "Hip Circle + Single-Leg RDL", reps: "8 each side" },
        ],
      },
      {
        block: "Power Combination Circuit",
        duration: "13 min",
        color: "border-l-red-500",
        exercises: [
          { name: "Squat Jump → Broad Jump (combo)", sets: 4, reps: "4 combos", rest: "60 sec", notes: "Land squat, immediately broad jump forward" },
          { name: "Push-Up → Explosive Row (super set)", sets: 3, reps: "5 push-ups + 5 rows", rest: "50 sec", notes: "No rest between push-up and row" },
          { name: "Med Ball Rotational Slam", sets: 3, reps: "6 each side", rest: "40 sec" },
          { name: "Sprawl to Jump", sets: 3, reps: "5", rest: "50 sec", notes: "Burpee-style — emphasize explosive vertical" },
        ],
      },
      {
        block: "Core Integration",
        duration: "7 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Plank-to-Push-Up", sets: 3, reps: "10", rest: "30 sec" },
          { name: "Windshield Wipers", sets: 3, reps: "8 each side", rest: "30 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "World's Greatest Stretch", reps: "4 each side" },
          { name: "Supine Spinal Twist", duration: "40 sec each side" },
          { name: "Box Breathing", duration: "2 min", notes: "4-4-4-4 pattern" },
        ],
      },
    ],
  },
  {
    week: 5,
    theme: "Speed Endurance",
    focus: "Power Under Fatigue",
    totalTime: "30 min",
    intensity: "High",
    description: "Sprint swimmers must hold power through the final 25m. This week trains the ability to stay explosive when fatigued — a direct simulation of the back half of a 100.",
    blocks: [
      {
        block: "Cardiac Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Jumping Jacks → High Knees → Butt Kicks (cycle)", duration: "3 min continuous" },
          { name: "Hip Flexor Lunge + T-Spine Reach", reps: "6 each side" },
        ],
      },
      {
        block: "Fatigue-Resistance Supersets",
        duration: "15 min",
        color: "border-l-red-500",
        exercises: [
          { name: "Round 1: 10 Jump Squats → 10 Push-Ups → 10 Rows", sets: 3, rest: "75 sec", notes: "No rest within the round — full rest between" },
          { name: "Round 2: 8 Broad Jumps → 8 Lat Pull-Downs", sets: 3, rest: "75 sec" },
          { name: "Round 3: 10 Bounding Steps → 10 Med Ball Slams", sets: 3, rest: "75 sec" },
        ],
      },
      {
        block: "Core Finisher",
        duration: "5 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Hollow Rock", sets: 3, duration: "20 sec", rest: "20 sec" },
          { name: "V-Up with Pause", sets: 3, reps: "8", rest: "20 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Standing Forward Fold", duration: "45 sec" },
          { name: "Lat Stretch (door or floor)", duration: "40 sec each" },
          { name: "Slow full-body shake out", duration: "1 min" },
        ],
      },
    ],
  },
  {
    week: 6,
    theme: "Peak Power",
    focus: "Max Effort Output",
    totalTime: "30 min",
    intensity: "High",
    description: "Maximum intensity week. Every set is done at absolute peak effort. Volume is lower — quality is everything. This is the week that builds championship-level sprint output.",
    blocks: [
      {
        block: "Activation",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Glute Bridge March", sets: 2, reps: "10 each leg", rest: "15 sec" },
          { name: "Band Hip Abduction Walk", duration: "2 × 10m", rest: "20 sec" },
          { name: "Arm Swings + Shoulder Circles", duration: "45 sec" },
        ],
      },
      {
        block: "Peak Power Block",
        duration: "15 min",
        color: "border-l-red-500",
        exercises: [
          { name: "Maximal Vertical Jump", sets: 5, reps: "3", rest: "90 sec", notes: "Full 90 sec rest — each set should feel fresh" },
          { name: "Explosive Band Pull (simulated freestyle)", sets: 4, reps: "4 each arm", rest: "75 sec", notes: "Snap through full ROM at race speed" },
          { name: "Sprint Start (from crouch)", sets: 5, reps: "3 × 10m", rest: "60 sec", notes: "Full recovery — race effort every time" },
        ],
      },
      {
        block: "Shoulder Health Maintenance",
        duration: "5 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Band External Rotation", sets: 2, reps: "15 each", rest: "20 sec" },
          { name: "Prone I-Y-T", sets: 2, reps: "8 each", rest: "20 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Pigeon Pose", duration: "45 sec each side" },
          { name: "Overhead Shoulder Stretch", duration: "40 sec each" },
          { name: "Deep Breathing", duration: "2 min" },
        ],
      },
    ],
  },
  {
    week: 7,
    theme: "Taper & Activate",
    focus: "Pre-Meet Neural Priming",
    totalTime: "20 min",
    intensity: "Moderate",
    description: "Week 7 is a taper week. Volume drops sharply — the goal is to stay activated and sharp without accumulating fatigue. Perfect timing before a championship meet.",
    blocks: [
      {
        block: "Light Activation",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Leg Swings + Arm Swings", duration: "1 min" },
          { name: "Hip Circle × Ankle Pop", reps: "8 each" },
          { name: "Easy skip + A-Skip", duration: "20m each" },
        ],
      },
      {
        block: "Neural Primer (Short + Explosive)",
        duration: "10 min",
        color: "border-l-amber-500",
        exercises: [
          { name: "Vertical Jump", sets: 3, reps: "3", rest: "60 sec", notes: "Full reset — only 3 reps, max effort" },
          { name: "Explosive Row (band)", sets: 3, reps: "3 each arm", rest: "50 sec" },
          { name: "Broad Jump", sets: 2, reps: "3", rest: "60 sec" },
          { name: "Fast Push-Up", sets: 2, reps: "4", rest: "40 sec" },
        ],
      },
      {
        block: "Full-Body Flush & Stretch",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Inchworm Walk-Out", reps: "5" },
          { name: "Hip Flexor Stretch", duration: "40 sec each" },
          { name: "Child's Pose + Lat Reach", duration: "45 sec each side" },
          { name: "Slow neck rolls + wrist circles", duration: "30 sec" },
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

export default function SprintPowerProgram() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-red-500" />
          Sprint Power Program
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          7-week explosive speed program — optimized for sprint freestyle, butterfly, and start/turn power
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-primary">7</div>
          <div className="text-xs text-muted-foreground">Weeks</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-primary">30</div>
          <div className="text-xs text-muted-foreground">Min / Session</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-red-500">High</div>
          <div className="text-xs text-muted-foreground">Intensity</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-cyan-500">Speed</div>
          <div className="text-xs text-muted-foreground">Focus</div>
        </div>
      </div>

      <div className="space-y-3">
        {SPRINT_POWER_WORKOUTS.map((w) => <WorkoutCard key={w.week} workout={w} />)}
      </div>
      <p className="text-xs text-muted-foreground text-center pt-2">
        Designed for competitive sprinters. Allow 48h between sessions. Do not run during taper week.
      </p>
    </div>
  );
}
