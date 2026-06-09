import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { logger } from "@/lib/logger";
import { notifyError } from "@/lib/notify";
import { ModuleProvider } from "@/contexts/module-context";
import { LaunchModal } from "@/components/launch-modal";
import { OfflineBanner } from "@/components/offline-banner";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";

import LiveSite from "@/pages/live";
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

// Query/mutation failures are logged and surfaced as a single de-duplicated
// toast instead of bubbling up as raw unhandled rejections.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      notifyError("Couldn't load data", error, {
        logMessage: `Query failed: ${String(query.queryKey)}`,
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      notifyError("Action failed", error, { logMessage: "Mutation failed" });
    },
  }),
});

function GlobalErrorHandler() {
  useEffect(() => {
    function handleUnhandledRejection(ev: PromiseRejectionEvent) {
      notifyError("Unexpected error", ev.reason, {
        logMessage: "Unhandled promise rejection",
      });
    }
    function handleError(ev: ErrorEvent) {
      // Don't toast on every script error (can be noisy / third-party); just log.
      logger.error(ev.message || "Script error", ev.error ?? ev.message);
    }
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return null;
}

function Router() {
  return (
    <Switch>
      {/* Public, full-bleed meet website — rendered without the app shell. */}
      <Route path="/live/:meetId" component={LiveSite} />
      <Route component={AppShell} />
    </Switch>
  );
}

function AppShell() {
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
