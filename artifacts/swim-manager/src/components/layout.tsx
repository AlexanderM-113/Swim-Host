import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity, Users, MapPin, Settings, ReceiptText, Trophy,
  FileText, Globe, Monitor, ArrowLeftRight, Timer, Star, Layers,
  Dumbbell, Waves, LayoutGrid, Sparkles, ChevronLeft, ChevronRight, Menu, X,
  HandCoins, UserCheck, Droplets, ListChecks,
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
  { name: "Meet Entries", href: "/meet-entries", icon: ListChecks },
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
  { name: "Fundraising", href: "/fundraising", icon: HandCoins },
  { name: "Volunteers", href: "/volunteers", icon: UserCheck },
  { name: "Diving Manager", href: "/diving", icon: Droplets },
  { name: "Settings", href: "/settings", icon: Settings },
];

const MODULE_NAV: Record<string, string[]> = {
  meet: ["/", "/meets", "/timing", "/reports", "/sdif", "/scoreboard", "/analytics", "/volunteers", "/settings"],
  team: ["/", "/athletes", "/meet-entries", "/teams", "/groups", "/records", "/time-standards", "/billing", "/billing/payment-plans", "/reports", "/analytics", "/fundraising", "/volunteers", "/settings"],
  workout: ["/", "/workouts", "/athletes", "/groups", "/analytics", "/settings"],
  diving: ["/", "/diving", "/reports", "/settings"],
};

const MODULE_SECTIONS: Record<string, { label: string; hrefs: string[] }[]> = {
  meet: [
    { label: "Meet Management", hrefs: ["/meets", "/timing"] },
    { label: "Tools", hrefs: ["/reports", "/sdif", "/scoreboard"] },
    { label: "Smart Features", hrefs: ["/analytics"] },
    { label: "Club Ops", hrefs: ["/volunteers"] },
    { label: "System", hrefs: ["/settings"] },
  ],
  team: [
    { label: "Roster", hrefs: ["/athletes", "/meet-entries", "/teams", "/groups"] },
    { label: "Records & Finance", hrefs: ["/records", "/time-standards", "/billing", "/billing/payment-plans"] },
    { label: "Tools", hrefs: ["/reports"] },
    { label: "Smart Features", hrefs: ["/analytics"] },
    { label: "Club Ops", hrefs: ["/fundraising", "/volunteers"] },
    { label: "System", hrefs: ["/settings"] },
  ],
  workout: [
    { label: "Training", hrefs: ["/workouts", "/groups"] },
    { label: "Athletes", hrefs: ["/athletes"] },
    { label: "Smart Features", hrefs: ["/analytics"] },
    { label: "System", hrefs: ["/settings"] },
  ],
  diving: [
    { label: "Diving", hrefs: ["/diving"] },
    { label: "Tools", hrefs: ["/reports"] },
    { label: "System", hrefs: ["/settings"] },
  ],
};

const MODULE_ACCENT: Record<string, string> = {
  meet: "text-cyan-400",
  team: "text-indigo-400",
  workout: "text-teal-400",
  diving: "text-sky-400",
};

const MODULE_LABEL: Record<string, string> = {
  meet: "Meet Manager",
  team: "Team Manager",
  workout: "Workout Manager",
  diving: "Diving Manager",
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { activeModule, setShowLauncher } = useModule();
  const isMobile = useIsMobile();

  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebarCollapsed") === "true"; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try { localStorage.setItem("sidebarCollapsed", String(desktopCollapsed)); } catch {}
  }, [desktopCollapsed]);

  // Close mobile drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [location]);

  const collapsed = !isMobile && desktopCollapsed;

  function isActive(href: string) {
    return location === href || (href !== "/" && location.startsWith(href));
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item.href);
    return (
      <Link
        key={item.name}
        href={item.href}
        title={collapsed ? item.name : undefined}
        className={cn(
          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
          collapsed ? "justify-center px-2" : "",
          active
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className="h-4 w-4 flex-shrink-0" />
        {!collapsed && item.name}
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
        <Link href="/" title={collapsed ? "Dashboard" : undefined} className={cn(
          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
          collapsed ? "justify-center px-2" : "",
          isActive("/") ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}>
          <Activity className="h-4 w-4 flex-shrink-0" />
          {!collapsed && "Dashboard"}
        </Link>
        {sections.map(section => {
          const items = navToShow.filter(n => section.hrefs.includes(n.href) && n.href !== "/");
          if (!items.length) return null;
          return (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {section.label}
                </p>
              )}
              {collapsed && <div className="border-t border-sidebar-border/30 my-1" />}
              <div className="space-y-0.5">
                {items.map(renderNavItem)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const sidebarContent = (
    <div className="relative z-10 flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        "h-16 flex items-center border-b border-sidebar-border shrink-0",
        collapsed ? "justify-center px-2" : "px-5 gap-2"
      )}>
        {!collapsed && (
          <>
            <Waves className="h-5 w-5 text-cyan-400 flex-shrink-0" />
            <span className="font-black text-lg tracking-tight whitespace-nowrap">
              <span className="text-cyan-400 italic">SWIM</span>MANAGER
              <span className="text-sidebar-foreground/40 font-light ml-1 text-sm">PRO</span>
            </span>
          </>
        )}
        {collapsed && <Waves className="h-5 w-5 text-cyan-400" />}
      </div>

      {/* Module label */}
      {activeModule && !collapsed && (
        <div className={cn("px-4 py-2 border-b border-sidebar-border/50 text-xs font-semibold flex items-center gap-2", MODULE_ACCENT[activeModule])}>
          <LayoutGrid className="h-3 w-3" />
          {MODULE_LABEL[activeModule]}
        </div>
      )}

      {/* Nav */}
      <nav className={cn("flex-1 py-4 overflow-y-auto", collapsed ? "px-1.5" : "px-3")}>
        {renderNav()}
      </nav>

      {/* Footer */}
      <div className={cn("border-t border-sidebar-border pt-3 pb-3 space-y-1", collapsed ? "px-1.5" : "px-3")}>
        {!collapsed ? (
          <>
            <Button
              variant="ghost" size="sm"
              className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs"
              onClick={() => setShowLauncher(true)}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-2" />
              Switch Module
            </Button>
            {!isMobile && (
              <Button
                variant="ghost" size="sm"
                className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent text-xs"
                onClick={() => setDesktopCollapsed(true)}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-2" />
                Collapse
              </Button>
            )}
            <p className="text-xs text-sidebar-foreground/30 text-center px-2 pt-1">SwimManager Pro v1.0</p>
          </>
        ) : (
          <>
            <button
              title="Switch Module"
              onClick={() => setShowLauncher(true)}
              className="w-full flex justify-center py-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              title="Expand sidebar"
              onClick={() => setDesktopCollapsed(false)}
              className="w-full flex justify-center py-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans">

      {/* Mobile overlay backdrop */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop: sticky, mobile: fixed drawer */}
      <aside
        className={cn(
          "text-sidebar-foreground flex flex-col shrink-0 border-r border-sidebar-border shadow-lg relative overflow-hidden transition-all duration-200",
          isMobile
            ? cn("fixed inset-y-0 left-0 z-40 w-64 h-full", mobileOpen ? "translate-x-0" : "-translate-x-full")
            : cn("sticky top-0 h-screen", collapsed ? "w-14" : "w-64")
        )}
        style={{ background: "hsl(var(--sidebar))" }}
      >
        {/* Pool water background overlay */}
        <div
          className="absolute inset-0 opacity-[0.07] bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: "url('/pool-bg.jpg')" }}
          aria-hidden="true"
        />
        {sidebarContent}

        {/* Mobile close button */}
        {isMobile && mobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-4 right-4 z-50 text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        {isMobile && (
          <div className="h-14 flex items-center gap-3 px-4 border-b bg-background/95 backdrop-blur sticky top-0 z-20 shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="text-foreground/70 hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-black text-base tracking-tight">
              <span className="text-cyan-500 italic">SWIM</span>MANAGER
              <span className="text-muted-foreground font-light ml-1 text-xs">PRO</span>
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
