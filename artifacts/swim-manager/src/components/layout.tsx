import { Link, useLocation } from "wouter";
import {
  Activity, Users, MapPin, Calculator, Settings, ReceiptText, Trophy,
  FileText, Globe, Monitor, ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { name: "Dashboard", href: "/", icon: Activity },
    { name: "Meet Manager", href: "/meets", icon: Trophy },
    { name: "Athletes", href: "/athletes", icon: Users },
    { name: "Teams", href: "/teams", icon: MapPin },
    { name: "Workouts", href: "/workouts", icon: Calculator },
    { name: "Billing", href: "/billing", icon: ReceiptText },
    { name: "Reports", href: "/reports", icon: FileText },
    { name: "SDIF / Import-Export", href: "/sdif", icon: ArrowLeftRight },
    { name: "Web Generator", href: "/webgen", icon: Globe },
    { name: "Scoreboard", href: "/scoreboard", icon: Monitor },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans">
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shrink-0 sticky top-0 h-screen border-r border-sidebar-border shadow-lg">
        <div className="h-16 flex items-center px-6 font-bold text-xl tracking-tight border-b border-sidebar-border bg-sidebar">
          <span className="text-sidebar-primary-foreground mr-2 font-black italic">SWIM</span> MANAGER PRO
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/50 text-center">SwimManager Pro v1.0</p>
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
