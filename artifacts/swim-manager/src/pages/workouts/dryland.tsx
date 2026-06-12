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

const WORKOUTS: DryLandWorkout[] = [
  {
    week: 1,
    theme: "Foundation",
    focus: "Movement Prep & Body Awareness",
    totalTime: "30 min",
    intensity: "Low",
    description: "Introduce athletes to dry land movement. Focus on proper form over speed or load. Build habits that transfer directly to water.",
    blocks: [
      {
        block: "Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Jumping Jacks", duration: "45 sec" },
          { name: "Arm Circles (forward + backward)", duration: "30 sec each" },
          { name: "Hip Circles", duration: "30 sec" },
          { name: "Leg Swings (front/back, side/side)", reps: "10 each leg" },
        ],
      },
      {
        block: "Core Foundation",
        duration: "10 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Dead Bug", sets: 3, reps: "8 each side", rest: "30 sec", notes: "Lower back stays pressed to floor" },
          { name: "Bird Dog", sets: 3, reps: "8 each side", rest: "30 sec" },
          { name: "Hollow Body Hold", sets: 3, duration: "20 sec", rest: "20 sec" },
        ],
      },
      {
        block: "Strength Circuit",
        duration: "10 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Bodyweight Squats", sets: 3, reps: "12", rest: "30 sec" },
          { name: "Push-Ups (knees ok)", sets: 3, reps: "8-10", rest: "30 sec" },
          { name: "Glute Bridges", sets: 3, reps: "12", rest: "30 sec", notes: "Squeeze at top for 2 sec" },
          { name: "Superman Hold", sets: 3, duration: "15 sec", rest: "15 sec" },
        ],
      },
      {
        block: "Cool-Down & Stretch",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Child's Pose", duration: "45 sec" },
          { name: "Hip Flexor Stretch", duration: "30 sec each side" },
          { name: "Doorway Chest Stretch", duration: "30 sec each side" },
          { name: "Deep Breathing", duration: "1 min", notes: "4 counts in, 6 counts out" },
        ],
      },
    ],
  },
  {
    week: 2,
    theme: "Strength Introduction",
    focus: "Upper & Lower Body Basics",
    totalTime: "30 min",
    intensity: "Moderate",
    description: "Begin loading movement patterns. Swimmers discover muscular connection between dry land and their strokes.",
    blocks: [
      {
        block: "Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "High Knees", duration: "30 sec" },
          { name: "Butt Kicks", duration: "30 sec" },
          { name: "World's Greatest Stretch", reps: "5 each side" },
          { name: "T-Spine Rotations", reps: "10 each side" },
        ],
      },
      {
        block: "Upper Body Pull Focus",
        duration: "10 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Resistance Band Pull-Aparts", sets: 3, reps: "15", rest: "20 sec" },
          { name: "Resistance Band Lat Pull-Down (or towel sub)", sets: 3, reps: "12", rest: "30 sec" },
          { name: "Prone Y-T-W", sets: 3, reps: "8 each position", rest: "30 sec", notes: "Slow and controlled — builds shoulder stability" },
        ],
      },
      {
        block: "Lower Body & Posterior Chain",
        duration: "10 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Reverse Lunges", sets: 3, reps: "10 each leg", rest: "30 sec" },
          { name: "Single-Leg Glute Bridge", sets: 3, reps: "10 each leg", rest: "30 sec" },
          { name: "Nordic Hamstring Curl (partner or door)", sets: 2, reps: "6", rest: "45 sec", notes: "Slow eccentric — prevent hamstring injury" },
          { name: "Calf Raises", sets: 2, reps: "20", rest: "20 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Pigeon Pose", duration: "45 sec each side" },
          { name: "Overhead Tricep Stretch", duration: "30 sec each side" },
          { name: "Lat Stretch (wall or floor)", duration: "45 sec" },
          { name: "Slow neck rolls", duration: "30 sec" },
        ],
      },
    ],
  },
  {
    week: 3,
    theme: "Core Focus",
    focus: "Rotational Power & Stability",
    totalTime: "30 min",
    intensity: "Moderate",
    description: "Swimming is a rotational sport. This week targets anti-rotation stability and rotational power — directly improving stroke efficiency.",
    blocks: [
      {
        block: "Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Inchworm Walk-Outs", reps: "6" },
          { name: "Hip 90/90 Switches", reps: "10 total", notes: "Each knee lifts and places" },
          { name: "Thoracic Rotations (all fours)", reps: "10 each side" },
          { name: "Cat-Cow", reps: "10 slow" },
        ],
      },
      {
        block: "Anti-Rotation Core",
        duration: "8 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Pallof Press (band at anchor)", sets: 3, reps: "10 each side", rest: "30 sec", notes: "Hold 2 sec at extension" },
          { name: "Side Plank", sets: 3, duration: "25 sec each side", rest: "20 sec" },
          { name: "Plank Shoulder Taps", sets: 3, reps: "12 each side", rest: "30 sec", notes: "Hips stay square" },
        ],
      },
      {
        block: "Rotational Power",
        duration: "12 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Medicine Ball Rotational Throw (wall or partner)", sets: 3, reps: "8 each side", rest: "30 sec" },
          { name: "Russian Twists", sets: 3, reps: "20 total", rest: "30 sec" },
          { name: "Bicycle Crunches (slow & controlled)", sets: 3, reps: "16 total", rest: "30 sec" },
          { name: "Woodchop (band or weight)", sets: 3, reps: "10 each side", rest: "30 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Supine Spinal Twist", duration: "45 sec each side" },
          { name: "Figure-Four Stretch", duration: "45 sec each side" },
          { name: "Box Breathing", duration: "2 min", notes: "4 counts in, 4 hold, 4 out, 4 hold" },
        ],
      },
    ],
  },
  {
    week: 4,
    theme: "Power Development",
    focus: "Explosive Starts & Turns",
    totalTime: "30 min",
    intensity: "High",
    description: "Build explosive power for starts, turns, and underwater kick. Focus on fast-twitch recruitment while maintaining control.",
    blocks: [
      {
        block: "Dynamic Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "A-Skip", duration: "20m x2" },
          { name: "Lateral Shuffle", duration: "20m x2" },
          { name: "Power Skips", reps: "10" },
          { name: "Squat Jumps (sub-max, form only)", reps: "5" },
        ],
      },
      {
        block: "Plyometric Circuit",
        duration: "12 min",
        color: "border-l-red-500",
        exercises: [
          { name: "Broad Jump", sets: 4, reps: "5", rest: "45 sec", notes: "Stick the landing — simulate block entry" },
          { name: "Vertical Jump with Arm Drive", sets: 4, reps: "5", rest: "45 sec" },
          { name: "Lateral Box Jump (step ok)", sets: 3, reps: "6 each side", rest: "30 sec" },
          { name: "Squat Jump with 2-sec Hold", sets: 3, reps: "6", rest: "45 sec" },
        ],
      },
      {
        block: "Strength Power",
        duration: "8 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Jump Lunge", sets: 3, reps: "8 each leg", rest: "40 sec" },
          { name: "Explosive Push-Up (clap or fast)", sets: 3, reps: "6", rest: "40 sec" },
          { name: "Medicine Ball Slam", sets: 3, reps: "8", rest: "30 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Standing Quad Stretch", duration: "30 sec each" },
          { name: "Hamstring Stretch (forward fold)", duration: "45 sec" },
          { name: "Chest Opener Arms Behind Back", duration: "30 sec" },
          { name: "Shake out legs & arms", duration: "1 min" },
        ],
      },
    ],
  },
  {
    week: 5,
    theme: "Agility & Flexibility",
    focus: "Streamline Position & Range of Motion",
    totalTime: "30 min",
    intensity: "Moderate",
    description: "Flexibility and mobility are performance multipliers in swimming. This week targets the shoulder complex, ankles, and hip flexors critical for streamline.",
    blocks: [
      {
        block: "Mobility Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Shoulder CARS (Controlled Articular Rotations)", reps: "5 each shoulder, slow" },
          { name: "Ankle Circles", reps: "10 each direction per ankle" },
          { name: "Hip Flexor Lunge with Reach", reps: "8 each side" },
          { name: "Thread the Needle", reps: "8 each side" },
        ],
      },
      {
        block: "Agility Ladder / Footwork",
        duration: "8 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Two-Feet-In / Out Ladder", duration: "3 x 10m", rest: "20 sec" },
          { name: "Ickey Shuffle", duration: "3 x 10m", rest: "20 sec" },
          { name: "Lateral In-Out", duration: "3 x 10m", rest: "20 sec" },
          { name: "Fast Feet (5 sec burst)", sets: 5, duration: "5 sec", rest: "15 sec" },
        ],
      },
      {
        block: "Streamline Flexibility Circuit",
        duration: "12 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Wall Overhead Stretch (face wall, hands up)", duration: "45 sec x3", rest: "15 sec", notes: "Key for overhead streamline position" },
          { name: "Doorway Chest Stretch", duration: "45 sec each position x2" },
          { name: "Couch Stretch (hip flexor)", duration: "45 sec each side x2" },
          { name: "Seated Ankle Dorsiflexion Stretch", duration: "45 sec each side x2", notes: "Feet pointed — critical for kick" },
          { name: "Prone Shoulder Extension (arms behind back, lift)", sets: 3, duration: "20 sec", rest: "20 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Full body hang (bar or doorframe)", duration: "30 sec x2" },
          { name: "Child's Pose with Side Reach", duration: "30 sec each side" },
          { name: "Relaxed breathing in supine", duration: "1.5 min" },
        ],
      },
    ],
  },
  {
    week: 6,
    theme: "Sport-Specific",
    focus: "Stroke-Specific Strength",
    totalTime: "30 min",
    intensity: "High",
    description: "Map dry land movements directly onto swim strokes. Every exercise mimics a phase of freestyle, butterfly, backstroke, or breaststroke.",
    blocks: [
      {
        block: "Activation Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Band Pull-Aparts", reps: "20" },
          { name: "Face Pulls (band)", reps: "15" },
          { name: "Monster Walk with Band", duration: "20m each direction" },
          { name: "Mini-Band Lateral Steps", duration: "20m each direction" },
        ],
      },
      {
        block: "Freestyle / Backstroke Pull Pattern",
        duration: "8 min",
        color: "border-l-blue-500",
        exercises: [
          { name: "Bent-Over Dumbbell Row (simulate catch)", sets: 3, reps: "10 each arm", rest: "30 sec", notes: "High elbow — mimic early vertical forearm" },
          { name: "Standing Band Pull-Down (straight arm)", sets: 3, reps: "12", rest: "30 sec", notes: "Simulate freestyle pull-through" },
          { name: "Single-Arm Cable/Band Row", sets: 3, reps: "10 each side", rest: "30 sec" },
        ],
      },
      {
        block: "Butterfly / Breaststroke Power",
        duration: "8 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Dumbbell Fly (flat or incline)", sets: 3, reps: "10", rest: "30 sec", notes: "Mimic butterfly pull pattern" },
          { name: "Breaststroke Kick Seated Band Pull", sets: 3, reps: "12", rest: "30 sec", notes: "Band at feet, simulate breaststroke kick" },
          { name: "Push-Up with Wide Hand Position", sets: 3, reps: "10", rest: "30 sec" },
          { name: "Hip Extension Kick (donkey kick with band)", sets: 3, reps: "12 each", rest: "20 sec" },
        ],
      },
      {
        block: "Cool-Down",
        duration: "9 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Foam Roll Lats (90 sec each side)", duration: "3 min total" },
          { name: "Foam Roll Thoracic Spine", duration: "2 min" },
          { name: "Pectoral Doorway Stretch", duration: "45 sec each" },
          { name: "Slow deep breathing + visualization", duration: "2 min", notes: "Athletes visualize race and stroke technique" },
        ],
      },
    ],
  },
  {
    week: 7,
    theme: "Peak & Test",
    focus: "Full-Body Integration",
    totalTime: "30 min",
    intensity: "High",
    description: "Culminating workout that tests everything learned. Athletes perform max reps for benchmark tracking — repeat at season end to measure progress.",
    blocks: [
      {
        block: "Performance Warm-Up",
        duration: "5 min",
        color: "border-l-cyan-500",
        exercises: [
          { name: "Dynamic Lunge Flow", reps: "10 each side" },
          { name: "Explosive Arm Swings", reps: "15 each direction" },
          { name: "Jump Rope or Fast Feet", duration: "60 sec" },
          { name: "Glute Activation Band Walk", duration: "30 sec each direction" },
        ],
      },
      {
        block: "Benchmark Test — Record Scores",
        duration: "15 min",
        color: "border-l-red-500",
        exercises: [
          { name: "Max Push-Ups in 60 sec", duration: "60 sec", notes: "Record number — repeat end of season to track progress" },
          { name: "Max Hollow Body Hold", duration: "as long as possible", notes: "Record seconds" },
          { name: "Standing Broad Jump", reps: "3 attempts", notes: "Record best distance in cm/inches" },
          { name: "Max Pull-Ups or Band-Assisted Pull-Ups", reps: "1 set to failure", notes: "Record number" },
          { name: "30-sec Plank Hold (count shoulder taps)", duration: "30 sec", notes: "Count taps while holding plank" },
        ],
      },
      {
        block: "Full-Body Burnout",
        duration: "5 min",
        color: "border-l-indigo-500",
        exercises: [
          { name: "Burpees", duration: "30 sec on / 15 sec off x4" },
          { name: "Jump Squat", duration: "30 sec on / 15 sec off x2" },
        ],
      },
      {
        block: "Celebration Cool-Down",
        duration: "5 min",
        color: "border-l-teal-500",
        exercises: [
          { name: "Full-body stretch sequence", duration: "3 min", notes: "Athlete-led — each person picks their tightest area" },
          { name: "Team circle breathing + reflection", duration: "2 min", notes: "What improved most over 7 weeks?" },
        ],
      },
    ],
  },
];

function ExerciseRow({ ex }: { ex: Exercise }) {
  return (
    <div className="flex flex-wrap items-start gap-x-4 gap-y-0.5 py-1.5 border-b border-border/40 last:border-0 text-sm">
      <span className="font-medium flex-1 min-w-0">{ex.name}</span>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground shrink-0">
        {ex.sets && <span>{ex.sets} sets</span>}
        {ex.reps && <span>× {ex.reps}</span>}
        {ex.duration && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ex.duration}</span>}
        {ex.rest && <span>Rest: {ex.rest}</span>}
      </div>
      {ex.notes && (
        <p className="w-full text-xs text-cyan-600 dark:text-cyan-400 italic pl-1">{ex.notes}</p>
      )}
    </div>
  );
}

function WorkoutCard({ workout }: { workout: DryLandWorkout }) {
  const [open, setOpen] = useState(false);

  return (
    <Card className={cn("transition-all", open ? "ring-1 ring-primary/30" : "")}>
      <button
        type="button"
        className="w-full text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-lg shrink-0">
                {workout.week}
              </div>
              <div>
                <CardTitle className="text-base leading-tight">
                  Week {workout.week} — {workout.theme}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">{workout.focus}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={cn("text-[10px] border", INTENSITY_COLOR[workout.intensity])}>
                <Flame className="h-2.5 w-2.5 mr-1" />
                {workout.intensity}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                <Clock className="h-2.5 w-2.5 mr-1" />
                {workout.totalTime}
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
              <div>
                {block.exercises.map((ex, i) => (
                  <ExerciseRow key={i} ex={ex} />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

const ALL_FOCUS_AREAS = Array.from(new Set(WORKOUTS.map((w) => w.focus)));

const FOCUS_KEYWORDS: Record<string, string> = {
  "Movement Prep & Body Awareness": "Movement Prep",
  "Upper & Lower Body Basics": "Upper/Lower",
  "Rotational Power & Stability": "Rotational Power",
  "Explosive Starts & Turns": "Explosiveness",
  "Streamline Position & Range of Motion": "Flexibility",
  "Stroke-Specific Strength": "Stroke-Specific",
  "Full-Body Integration": "Full-Body",
};

export default function DryLandProgram() {
  const [filterIntensity, setFilterIntensity] = useState<string>("All");
  const [filterFocus, setFilterFocus] = useState<string>("All");
  const [filterWeek, setFilterWeek] = useState<string>("All");

  const filtered = WORKOUTS.filter((w) => {
    if (filterIntensity !== "All" && w.intensity !== filterIntensity) return false;
    if (filterFocus !== "All" && w.focus !== filterFocus) return false;
    if (filterWeek !== "All" && String(w.week) !== filterWeek) return false;
    return true;
  });

  const activeFilterCount = [filterIntensity, filterFocus, filterWeek].filter((f) => f !== "All").length;

  function clearFilters() {
    setFilterIntensity("All");
    setFilterFocus("All");
    setFilterWeek("All");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-teal-500" />
            Dry Land Program
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            7-week progressive dry land program — 30 minutes per session
          </p>
        </div>
        {activeFilterCount > 0 && (
          <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground" onClick={clearFilters}>
            Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
          </Button>
        )}
      </div>

      {/* Refiner row 1 — Intensity */}
      <div className="flex items-center gap-2 flex-wrap">
        <Target className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground font-medium w-14 shrink-0">Intensity</span>
        {["All", "Low", "Moderate", "High"].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filterIntensity === f ? "default" : "outline"}
            className="h-7 text-xs px-3"
            onClick={() => setFilterIntensity(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      {/* Refiner row 2 — Focus Area */}
      <div className="flex items-center gap-2 flex-wrap">
        <Flame className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs text-muted-foreground font-medium w-14 shrink-0">Focus</span>
        <Button
          size="sm"
          variant={filterFocus === "All" ? "default" : "outline"}
          className="h-7 text-xs px-3"
          onClick={() => setFilterFocus("All")}
        >
          All
        </Button>
        {ALL_FOCUS_AREAS.map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filterFocus === f ? "default" : "outline"}
            className="h-7 text-xs px-3"
            onClick={() => setFilterFocus(f)}
          >
            {FOCUS_KEYWORDS[f] ?? f}
          </Button>
        ))}
      </div>

      {/* Refiner row 3 — Week */}
      <div className="flex items-center gap-2 flex-wrap">
        <Clock className="h-4 w-4 text-cyan-500 shrink-0" />
        <span className="text-xs text-muted-foreground font-medium w-14 shrink-0">Week</span>
        {["All", ...WORKOUTS.map((w) => String(w.week))].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filterWeek === f ? "default" : "outline"}
            className="h-7 text-xs px-3"
            onClick={() => setFilterWeek(f)}
          >
            {f === "All" ? "All" : `Wk ${f}`}
          </Button>
        ))}
      </div>

      {/* Program overview */}
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
          <div className="text-2xl font-bold text-teal-500">Progressive</div>
          <div className="text-xs text-muted-foreground">Intensity</div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="text-2xl font-bold text-cyan-500">Swim</div>
          <div className="text-xs text-muted-foreground">Specific</div>
        </div>
      </div>

      {/* Workout cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No workouts match the selected filters.
          </div>
        ) : (
          filtered.map((w) => (
            <WorkoutCard key={w.week} workout={w} />
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center pt-2">
        Click any week to expand the full workout. Each session builds on the previous week.
      </p>
    </div>
  );
}
