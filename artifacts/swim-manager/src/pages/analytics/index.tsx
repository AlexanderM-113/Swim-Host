import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Zap, Heart, Video, Camera, ChevronRight,
  DollarSign, Activity
} from "lucide-react";

const MODULES = [
  {
    href: "/analytics/financial",
    title: "Financial Intelligence",
    description: "Revenue analysis, billing health, meet profitability, cost-per-athlete, and budget tracking — all pulled live from your club's billing data.",
    icon: DollarSign,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
    badge: "Live Data",
    badgeVariant: "bg-emerald-600",
    tags: ["Revenue", "Invoicing", "Profitability"],
  },
  {
    href: "/analytics/relay",
    title: "Smart Relay Builder",
    description: "Algorithm-driven relay lineup optimization. Finds the fastest possible combination of your athletes for every relay leg based on their personal bests.",
    icon: Zap,
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    badge: "Algorithm",
    badgeVariant: "bg-amber-600",
    tags: ["4×100", "4×200", "Medley", "Optimization"],
  },
  {
    href: "/analytics/readiness",
    title: "Athlete Readiness Score",
    description: "Daily check-ins tracking sleep quality, energy level, muscle soreness, attendance, and injury status. Color-coded Green/Yellow/Red scoring per athlete.",
    icon: Heart,
    color: "text-rose-600",
    bg: "bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
    badge: "Daily",
    badgeVariant: "bg-rose-600",
    tags: ["Sleep", "Energy", "HRV", "Injury"],
  },
  {
    href: "/analytics/video",
    title: "Video Race Analysis",
    description: "Upload race footage for automatic detection of start reaction times, turns, stroke mechanics, split breakdowns, and underwater breakouts.",
    icon: Video,
    color: "text-sky-600",
    bg: "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800",
    badge: "AI",
    badgeVariant: "bg-sky-600",
    tags: ["Splits", "Turns", "Reaction", "Stroke Rate"],
  },
  {
    href: "/analytics/technique",
    title: "Technique Analytics",
    description: "Computer vision analysis of underwater body alignment, kick efficiency, head position, arm entry angle, and early vertical forearm (EVF) catch phase.",
    icon: Camera,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800",
    badge: "CV",
    badgeVariant: "bg-violet-600",
    tags: ["Alignment", "Kick", "EVF", "Turns"],
  },
];

export default function SmartFeaturesHub() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl overflow-hidden border border-cyan-200 dark:border-cyan-800 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-indigo-500/10 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <Sparkles className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Smart Features</h1>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Data-driven insights, AI-powered technique analysis, and intelligent coaching tools built directly into SwimManager Pro.
          Everything works offline with your local data.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {MODULES.map((mod) => (
          <Link key={mod.href} href={mod.href}>
            <Card className={`border-2 hover:shadow-lg transition-all cursor-pointer group ${mod.bg}`}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-white/60 dark:bg-black/20 border ${mod.bg} shrink-0`}>
                    <mod.icon className={`h-7 w-7 ${mod.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-lg">{mod.title}</span>
                      <Badge className={`text-[10px] ${mod.badgeVariant} text-white shrink-0`}>{mod.badge}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{mod.description}</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {mod.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-dashed border-cyan-300 dark:border-cyan-800">
        <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-30 text-cyan-500" />
          <div className="font-medium">Wearable Integration Coming Soon</div>
          <div className="text-sm mt-1 max-w-sm mx-auto">
            Connect Garmin, WHOOP, Polar, and Apple Watch for automatic HRV, sleep, and recovery data in Athlete Readiness.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
