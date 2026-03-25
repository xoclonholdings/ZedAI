import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Chat from "@/pages/chat";
import Login from "@/pages/login";

// Error boundary component to catch any rendering issues
function ErrorBoundary({ children }: { children: React.ReactNode }) {
  return children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center no-flash">
      <div className="text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 rounded-full animate-pulse"></div>
        </div>
        <div className="text-xl font-medium bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
          ZED
        </div>
        <div className="text-sm text-gray-400 mt-2">Loading...</div>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/">
        {isLoading ? (
          <LoadingScreen />
        ) : !isAuthenticated ? (
          <Login />
        ) : (
          <Chat />
        )}
      </Route>
      <Route path="/chat/:id?">
        {isLoading ? (
          <LoadingScreen />
        ) : !isAuthenticated ? (
          <Login />
        ) : (
          <Chat />
        )}
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
