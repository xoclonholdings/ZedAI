import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/components/auth/UseAuth";
import NotFound from "@/pages/not-found";
import Chat from "@/pages/chat";
import Login from "@/pages/login";

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center no-flash">
      <div className="text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 animate-pulse" />
        </div>
        <div className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-xl font-medium text-transparent">
          ZED
        </div>
        <div className="mt-2 text-sm text-gray-400">Loading...</div>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <Chat /> : <Login />}
      </Route>

      <Route path="/chat/:id?">
        {isAuthenticated ? <Chat /> : <Login />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;