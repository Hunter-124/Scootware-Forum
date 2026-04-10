import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import Home from "@/pages/Home";
import Subforum from "@/pages/Subforum";
import ThreadView from "@/pages/Thread";
import CreateThread from "@/pages/CreateThread";
import UserProfile from "@/pages/Profile";
import Products from "@/pages/Products";
import Store from "@/pages/Store";
import Upgrades from "@/pages/Upgrades";
import Loader from "@/pages/Loader";
import LuaDocs from "@/pages/LuaDocs";
import AdminDashboard from "@/pages/Admin";
import AccountSettings from "@/pages/AccountSettings";
import { Login, Register, ForgotPassword, ResetPassword } from "@/pages/AuthPages";
import SsoLink from "@/pages/SsoLink";
import SsoCreateUsername from "@/pages/SsoCreateUsername";
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
        <Route path="/forum/:id/new" component={CreateThread} />
        <Route path="/forum/:id" component={Subforum} />
        <Route path="/thread/:id" component={ThreadView} />
        <Route path="/profile/:id" component={UserProfile} />
        <Route path="/products" component={Products} />
        <Route path="/store" component={Store} />
        <Route path="/upgrades" component={Upgrades} />
        <Route path="/loader" component={Loader} />
        <Route path="/docs/lua" component={LuaDocs} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/sso-create-username" component={SsoCreateUsername} />
        <Route path="/sso-link" component={SsoLink} />
        <Route path="/account" component={AccountSettings} />
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
