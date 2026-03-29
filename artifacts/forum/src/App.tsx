import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Home from "@/pages/Home";
import Subforum from "@/pages/Subforum";
import ThreadView from "@/pages/Thread";
import UserProfile from "@/pages/Profile";
import Upgrades from "@/pages/Upgrades";
import Loader from "@/pages/Loader";
import AdminDashboard from "@/pages/Admin";
import { Login, Register } from "@/pages/AuthPages";
import NotFound from "@/pages/not-found";

// Central query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/forum/:id" component={Subforum} />
        <Route path="/thread/:id" component={ThreadView} />
        <Route path="/profile/:id" component={UserProfile} />
        <Route path="/upgrades" component={Upgrades} />
        <Route path="/loader" component={Loader} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/admin" component={AdminDashboard} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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
