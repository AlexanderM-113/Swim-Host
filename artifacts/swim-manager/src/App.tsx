import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/layout";
import { ModuleProvider } from "@/contexts/module-context";
import { LaunchModal } from "@/components/launch-modal";
import { OfflineBanner } from "@/components/offline-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Meets from "@/pages/meets";
import NewMeet from "@/pages/meets/new";
import MeetDetail from "@/pages/meets/detail";
import Athletes from "@/pages/athletes";
import NewAthlete from "@/pages/athletes/new";
import AthleteDetail from "@/pages/athletes/detail";
import Teams from "@/pages/teams";
import NewTeam from "@/pages/teams/new";
import TeamDetail from "@/pages/teams/detail";
import Workouts from "@/pages/workouts";
import NewWorkout from "@/pages/workouts/new";
import WorkoutDetail from "@/pages/workouts/detail";
import Billing from "@/pages/billing";
import NewInvoice from "@/pages/billing/new";
import PaymentPlans from "@/pages/billing/payment-plans";
import Reports from "@/pages/reports";
import WebGen from "@/pages/webgen";
import Settings from "@/pages/settings";
import Scoreboard from "@/pages/scoreboard";
import SDIFPage from "@/pages/sdif";
import TimingConsole from "@/pages/timing";
import RecordsPage from "@/pages/records";
import GroupsPage from "@/pages/groups";
import TimeStandardsPage from "@/pages/time-standards";
import SmartFeaturesHub from "@/pages/analytics";
import FinancialIntelligence from "@/pages/analytics/financial";
import RelayBuilder from "@/pages/analytics/relay";
import AthleteReadiness from "@/pages/analytics/readiness";
import VideoAnalysis from "@/pages/analytics/video";
import TechniqueAnalytics from "@/pages/analytics/technique";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// In-memory log ring buffer (last 100 entries)
const logBuffer: { level: string; message: string; ts: string }[] = [];
export function getLogBuffer() { return [...logBuffer]; }

function addLog(level: string, message: string) {
  logBuffer.push({ level, message, ts: new Date().toISOString() });
  if (logBuffer.length > 100) logBuffer.shift();
}

function GlobalErrorHandler() {
  const { toast } = useToast();

  useEffect(() => {
    function handleUnhandledRejection(ev: PromiseRejectionEvent) {
      const msg = ev.reason instanceof Error ? ev.reason.message : String(ev.reason ?? "Unknown error");
      console.error("[unhandledRejection]", ev.reason);
      addLog("error", msg);
      toast({ title: "Unexpected error", description: msg.substring(0, 120), variant: "destructive" });
    }
    function handleError(ev: ErrorEvent) {
      console.error("[onerror]", ev.error ?? ev.message);
      addLog("error", ev.message ?? "Script error");
    }
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, [toast]);

  return null;
}

function Router() {
  return (
    <Layout>
      <LaunchModal />
      <OfflineBanner />
      <Switch>
        <Route path="/" component={Dashboard} />

        <Route path="/meets/new" component={NewMeet} />
        <Route path="/meets/:id/*?" component={MeetDetail} />
        <Route path="/meets" component={Meets} />

        <Route path="/athletes/new" component={NewAthlete} />
        <Route path="/athletes/:id" component={AthleteDetail} />
        <Route path="/athletes" component={Athletes} />

        <Route path="/teams/new" component={NewTeam} />
        <Route path="/teams/:id" component={TeamDetail} />
        <Route path="/teams" component={Teams} />

        <Route path="/workouts/new" component={NewWorkout} />
        <Route path="/workouts/:id" component={WorkoutDetail} />
        <Route path="/workouts" component={Workouts} />

        <Route path="/billing/payment-plans" component={PaymentPlans} />
        <Route path="/billing/new" component={NewInvoice} />
        <Route path="/billing" component={Billing} />

        <Route path="/reports" component={Reports} />
        <Route path="/sdif" component={SDIFPage} />
        <Route path="/webgen" component={WebGen} />

        <Route path="/settings" component={Settings} />
        <Route path="/scoreboard" component={Scoreboard} />

        <Route path="/timing" component={TimingConsole} />
        <Route path="/records" component={RecordsPage} />
        <Route path="/groups" component={GroupsPage} />
        <Route path="/time-standards" component={TimeStandardsPage} />

        <Route path="/analytics/financial" component={FinancialIntelligence} />
        <Route path="/analytics/relay" component={RelayBuilder} />
        <Route path="/analytics/readiness" component={AthleteReadiness} />
        <Route path="/analytics/video" component={VideoAnalysis} />
        <Route path="/analytics/technique" component={TechniqueAnalytics} />
        <Route path="/analytics" component={SmartFeaturesHub} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ModuleProvider>
          <ErrorBoundary>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <GlobalErrorHandler />
              <Router />
            </WouterRouter>
          </ErrorBoundary>
        </ModuleProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
