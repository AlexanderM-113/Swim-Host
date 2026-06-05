import { Link, useLocation } from "wouter";
import {
  Activity, Users, MapPin, Settings, ReceiptText, Trophy,
  FileText, Globe, Monitor, ArrowLeftRight, Timer, Star, Layers,
  Dumbbell, Waves, LayoutGrid, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useModule } from "@/contexts/module-context";
import { Button } from "@/components/ui/button";

interface NavItem { name: string; href: string; icon: React.ComponentType<{ className?: string }>; }

const ALL_NAV: NavItem[] = [
  { name: "Dashboard", href: "/", icon: Activity },

  { name: "Meet Manager", href: "/meets", icon: Trophy },
  { name: "Timing Console", href: "/timing", icon: Timer },

  { name: "Athletes", href: "/athletes", icon: Users },
  { name: "Teams", href: "/teams", icon: MapPin },
  { name: "Training Groups", href: "/groups", icon: Layers },
  { name: "Club Records", href: "/records", icon: Star },
  { name: "Time Standards", href: "/time-standards", icon: Trophy },
  { name: "Billing", href: "/billing", icon: ReceiptText },
  { name: "Payment Plans", href: "/billing/payment-plans", icon: ReceiptText },

  { name: "Workouts", href: "/workouts", icon: Dumbbell },

  { name: "Reports", href: "/reports", icon: FileText },
  { name: "SDIF / Import-Export", href: "/sdif", icon: ArrowLeftRight },
  { name: "Web Generator", href: "/webgen", icon: Globe },
  { name: "Scoreboard", href: "/scoreboard", icon: Monitor },
  { name: "Smart Features", href: "/analytics", icon: Sparkles },
  { name: "Settings", href: "/settings", icon: Settings },
];

const MODULE_NAV: Record<string, string[]> = {
  meet: ["/", "/meets", "/timing", "/reports", "/sdif", "/scoreboard", "/analytics", "/settings"],
  team: ["/", "/athletes", "/teams", "/groups", "/records", "/time-standards", "/billing", "/billing/payment-plans", "/reports", "/analytics", "/settings"],
  workout: ["/", "/workouts", "/athletes", "/groups", "/analytics", "/settings"],
};

const MODULE_SECTIONS: Record<string, { label: string; hrefs: string[] }[]> = {
  meet: [
    { label: "Meet Management", hrefs: ["/meets", "/timing"] },
    { label: "Tools", hrefs: ["/reports", "/sdif", "/scoreboard"] },
    { label: "Smart Features", hrefs: ["/analytics"] },
    { label: "System", hrefs: ["/settings"] },
  ],
  team: [
    { label: "Roster", hrefs: ["/athletes", "/teams", "/groups"] },
    { label: "Records & Finance", hrefs: ["/records", "/time-standards", "/billing", "/billing/payment-plans"] },
    { label: "Tools", hrefs: ["/reports"] },
    { label: "Smart Features", hrefs: ["/analytics"] },
    { label: "System", hrefs: ["/settings"] },
  ],
  workout: [
    { label: "Training", hrefs: ["/workouts", "/groups"] },
    { label: "Athletes", hrefs: ["/athletes"] },
    { label: "Smart Features", hrefs: ["/analytics"] },
    { label: "System", hrefs: ["/settings"] },
  ],
};

const MODULE_ACCENT: Record<string, string> = {
  meet: "text-cyan-400",
  team: "text-indigo-400",
  workout: "text-teal-400",
};

const MODULE_LABEL: Record<string, string> = {
  meet: "Meet Manager",
  team: "Team Manager",
  workout: "Workout Manager",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { activeModule, setShowLauncher } = useModule();

  function isActive(href: string) {
    return location === href || (href !== "/" && location.startsWith(href));
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item.href);
    return (
      <Link
        key={item.name}
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {item.name}
      </Link>
    );
  }

  const navToShow = activeModule
    ? ALL_NAV.filter(n => MODULE_NAV[activeModule]?.includes(n.href))
    : ALL_NAV;

  const sections = activeModule ? MODULE_SECTIONS[activeModule] : null;

  function renderNav() {
    if (!sections) {
      return (
        <div className="space-y-0.5">
          {navToShow.map(renderNavItem)}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <Link href="/" className={cn(
          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
          isActive("/") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}>
          <Activity className="h-4 w-4 flex-shrink-0" />Dashboard
        </Link>

        {sections.map(section => {
          const items = navToShow.filter(n => section.hrefs.includes(n.href) && n.href !== "/");
          if (!items.length) return null;
          return (
            <div key={section.label}>
              <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">{section.label}</p>
              <div className="space-y-0.5">
                {items.map(renderNavItem)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans">
      <aside
        className="w-64 text-sidebar-foreground flex flex-col shrink-0 sticky top-0 h-screen border-r border-sidebar-border shadow-lg relative overflow-hidden"
        style={{ background: "hsl(var(--sidebar))" }}
      >
        {/* Pool water background overlay */}
        <div
          className="absolute inset-0 opacity-[0.07] bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: "url('/pool-bg.jpg')" }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col h-full">
          <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
            <Waves className="h-5 w-5 text-cyan-400 mr-2 flex-shrink-0" />
            <span className="font-black text-lg tracking-tight">
              <span className="text-cyan-400 italic">SWIM</span>MANAGER<span className="text-sidebar-foreground/40 font-light ml-1 text-sm">PRO</span>
            </span>
          </div>

          {activeModule && (
            <div className={cn("px-4 py-2 border-b border-sidebar-border/50 text-xs font-semibold flex items-center gap-2", MODULE_ACCENT[activeModule])}>
              <LayoutGrid className="h-3 w-3" />
              {MODULE_LABEL[activeModule]}
            </div>
          )}

          <nav className="flex-1 px-3 py-4 overflow-y-auto">
            {renderNav()}
          </nav>

          <div className="px-3 pb-3 border-t border-sidebar-border pt-3 space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs"
              onClick={() => setShowLauncher(true)}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-2" />
              Switch Module
            </Button>
            <p className="text-xs text-sidebar-foreground/30 text-center px-2">SwimManager Pro v1.0</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
