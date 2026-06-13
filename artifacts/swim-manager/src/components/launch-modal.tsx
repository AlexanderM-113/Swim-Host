import { useModule, type AppModule } from "@/contexts/module-context";
import { Trophy, Users, Dumbbell, Waves, ChevronRight, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleCard {
  id: AppModule;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  features: string[];
}

const MODULES: ModuleCard[] = [
  {
    id: "meet",
    title: "Meet Manager",
    subtitle: "Run competitive meets",
    description: "Full meet lifecycle from setup through results.",
    icon: Trophy,
    accent: "from-blue-600 to-cyan-500",
    features: [
      "Create & configure meets",
      "Seed & run heats",
      "Live results & scoring",
      "Timing console interface",
      "Officials management",
      "Reports & heat sheets",
    ],
  },
  {
    id: "team",
    title: "Team Manager",
    subtitle: "Manage athletes & teams",
    description: "Complete roster, billing, and athlete development tools.",
    icon: Users,
    accent: "from-indigo-600 to-blue-500",
    features: [
      "Athlete roster & profiles",
      "Training groups",
      "Attendance tracking",
      "Billing & invoicing",
      "Club records",
      "Parent communications",
    ],
  },
  {
    id: "workout",
    title: "Workout Manager",
    subtitle: "Design training sessions",
    description: "Build, store, and assign professional workouts.",
    icon: Dumbbell,
    accent: "from-teal-600 to-cyan-500",
    features: [
      "Structured workout sets",
      "Training zone breakdown",
      "Volume tracking",
      "Group assignment",
      "Printable workout cards",
      "Season planning",
    ],
  },
  {
    id: "diving",
    title: "Diving Manager",
    subtitle: "Score & manage diving events",
    description: "Full diving meet management with DD tables and live scoring.",
    icon: Droplets,
    accent: "from-sky-600 to-cyan-400",
    features: [
      "Create diving meets",
      "Diver roster & categories",
      "Dive entry with DD lookup",
      "Judge score entry",
      "Live standings & reports",
      "1m / 3m / Platform events",
    ],
  },
];

export function LaunchModal() {
  const { showLauncher, setActiveModule } = useModule();

  if (!showLauncher) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1628]/95 backdrop-blur-sm">
      <div className="w-full max-w-5xl px-6 py-10">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Waves className="h-10 w-10 text-cyan-400" />
            <h1 className="text-4xl font-black tracking-tight text-white">
              <span className="text-cyan-400 italic">SWIM</span>MANAGER PRO
            </h1>
          </div>
          <p className="text-slate-400 text-lg">Professional Aquatic Club Management</p>
          <p className="text-slate-500 mt-2 text-sm">Choose your module to get started — you can switch anytime from the sidebar.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {MODULES.map((mod) => (
            <button
              key={mod.id}
              onClick={() => setActiveModule(mod.id)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5",
                "text-left p-6 transition-all duration-300",
                "hover:border-white/30 hover:bg-white/10 hover:scale-[1.02] hover:shadow-2xl",
                "focus:outline-none focus:ring-2 focus:ring-cyan-400"
              )}
            >
              <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br", mod.accent)} />

              <div className={cn("inline-flex p-3 rounded-xl bg-gradient-to-br mb-4", mod.accent)}>
                <mod.icon className="h-7 w-7 text-white" />
              </div>

              <h2 className="text-xl font-bold text-white mb-1">{mod.title}</h2>
              <p className="text-cyan-400 text-sm font-medium mb-2">{mod.subtitle}</p>
              <p className="text-slate-400 text-sm mb-5">{mod.description}</p>

              <ul className="space-y-1.5 mb-6">
                {mod.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm group-hover:gap-3 transition-all">
                Open {mod.title} <ChevronRight className="h-4 w-4" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
