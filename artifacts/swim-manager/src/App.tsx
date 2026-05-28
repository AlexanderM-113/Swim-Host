import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
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
import Settings from "@/pages/settings";
import Scoreboard from "@/pages/scoreboard";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
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

        <Route path="/settings" component={Settings} />

        <Route path="/scoreboard" component={Scoreboard} />
        
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
