import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Zap, Heart, Video, Camera, ChevronRight,
  DollarSign, Users, Trophy, Activity
} from "lucide-react";

const MODULES = [
  {
    href: "/analytics/financial",
    title: "Financial Intelligence",
    description: "Revenue analysis, billing health, meet profitability, cost-per-athlete, and budget tracking.",
    icon: DollarSign,
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    badge: "Live Data",
    badgeColor: "bg-green-600",
    tags: ["Revenue", "Invoicing", "Profitability"],
  },
  {
    href: "/analytics/relay",
    title: "Smart Relay Builder",
    description: "Algorithm-driven relay lineup optimization based on athletes' best times in each leg.",
    icon: Zap,
    color: "text-yellow-600",
    bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
    badge: "Algorithm",
    badgeColor: "bg-yellow-600",
    tags: ["4×100", "4×200", "Medley", "Optimization"],
  },
  {
    href: "/analytics/readiness",
    title: "Athlete Readiness Score",
    description: "Daily check-ins tracking sleep, energy, soreness, attendance, and injury status. Green/Yellow/Red scoring.",
    icon: Heart,
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    badge: "Daily",
    badgeColor: "bg-red-600",
    tags: ["Sleep", "Energy", "HRV", "Injury"],
  },
  {
    href: "/analytics/video",
    title: "Video Race Analysis",
    description: "Upload race footage for automatic detection of starts, turns, stroke mechanics, splits, and breakouts.",
    icon: Video,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    badge: "AI",
    badgeColor: "bg-blue-600",
    tags: ["Splits", "Turns", "Reaction", "Stroke Rate"],
  },
  {
    href: "/analytics/technique",
    title: "Technique Analytics",
    description: "Computer vision analysis of body alignment, kick efficiency, head position, arm entry, and catch phase.",
    icon: Camera,
    color: "text-purple-600",
    bg: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
    badge: "CV",
    badgeColor: "bg-purple-600",
    tags: ["Alignment", "Kick", "EVF", "Turns"],
  },
];

export default function AnalyticsHub() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-7 w-7 text-primary" />
          Analytics & Intelligence
        </h1>
        <p className="text-muted-foreground mt-1">
          Data-driven insights, AI-powered technique analysis, and intelligent coaching tools
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {MODULES.map((mod) => (
          <Link key={mod.href} href={mod.href}>
            <Card className={`border-2 hover:shadow-lg transition-all cursor-pointer group ${mod.bg}`}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl bg-white/60 dark:bg-black/20 border ${mod.bg}`}>
                    <mod.icon className={`h-7 w-7 ${mod.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-lg">{mod.title}</span>
                      <Badge className={`text-[10px] ${mod.badgeColor} text-white`}>{mod.badge}</Badge>
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

      <Card className="border-dashed">
        <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <div className="font-medium">Wearable Integration Coming Soon</div>
          <div className="text-sm mt-1">Connect Garmin, WHOOP, Polar, and Apple Watch for automatic HRV, sleep, and recovery data in Athlete Readiness.</div>
        </CardContent>
      </Card>
    </div>
  );
}
