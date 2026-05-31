import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { startAutoBackup } from "@/lib/backup-service";
import { Layout } from "@/components/layout";
import { ModuleProvider } from "@/contexts/module-context";
import { LaunchModal } from "@/components/launch-modal";
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
import Reports from "@/pages/reports";
import WebGen from "@/pages/webgen";
import Settings from "@/pages/settings";
import Scoreboard from "@/pages/scoreboard";
import SDIFPage from "@/pages/sdif";
import TimingConsole from "@/pages/timing";
import RecordsPage from "@/pages/records";
import GroupsPage from "@/pages/groups";
import AnalyticsHub from "@/pages/analytics";
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

function Router() {
  return (
    <Layout>
      <LaunchModal />
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

        <Route path="/analytics/financial" component={FinancialIntelligence} />
        <Route path="/analytics/relay" component={RelayBuilder} />
        <Route path="/analytics/readiness" component={AthleteReadiness} />
        <Route path="/analytics/video" component={VideoAnalysis} />
        <Route path="/analytics/technique" component={TechniqueAnalytics} />
        <Route path="/analytics" component={AnalyticsHub} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  useEffect(() => {
    startAutoBackup();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ModuleProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </ModuleProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
