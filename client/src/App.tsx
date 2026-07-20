import { Component, type ReactNode, useEffect } from "react";
import { Switch, Route, useParams } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/components/auth/UseAuth";
import { AuthProvider } from "@/components/auth/AuthContext";
import { installApiFetchPatch } from "@/lib/apiClient";
import { logClientRuntime } from "@/lib/runtimeLogger";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import HomePage from "@/pages/home";
import NexusRootPage from "@/nexus/pages/NexusRootPage";
import { NexusProvider } from "@/nexus";
import FlowsPage from "@/pages/flows";
import FlowDetailPage from "@/pages/flow-detail";
import { RunsListPage, RunDetailPage } from "@/pages/runs";
import ProjectDetailPage from "@/pages/project-detail";
import ProjectsPage from "@/pages/projects";
import { DecisionsListPage, DecisionDetailPage } from "@/pages/decisions";
import TimelinePage from "@/pages/timeline";
import DiscoveryPage from "@/pages/discovery";
import TradingPage from "@/pages/trading";
import BudgetPage from "@/pages/budget";
import WorkspacePage from "@/pages/workspace";
import HistoryPage from "@/pages/history";
import InboxPage from "@/pages/inbox";
import LearningPage from "@/pages/learning";
import LearningStudioPage from "@/pages/learning-studio";

installApiFetchPatch();

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    void logClientRuntime({
      level: "error",
      event: "react.error_boundary",
      detail: error.message,
      context: { stack: error.stack, componentStack: errorInfo.componentStack },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center px-6 text-center">
          <div>
            <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-2xl font-semibold text-transparent">
              ZAR encountered an error
            </div>
            <p className="mt-3 text-sm text-gray-400">
              The issue was logged for debugging. Refresh the app or open Admin once the session recovers.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <NexusRootPage /> : <Login />}
      </Route>

      <Route path="/chat/:id?">
        {isAuthenticated ? <NexusChatRoute /> : <Login />}
      </Route>

      <Route path="/home">
        {isAuthenticated ? <NexusRootPage /> : <Login />}
      </Route>

      <Route path="/nexus">
        {isAuthenticated ? <NexusRootPage /> : <Login />}
      </Route>

      <Route path="/nexus/:nodeId/:view?">
        {isAuthenticated ? <NexusRootPage /> : <Login />}
      </Route>

      <Route path="/knowledge-map">
        {isAuthenticated ? <HomePage /> : <Login />}
      </Route>

      <Route path="/admin">
        {!isAuthenticated ? <Login /> : isAdmin ? <Admin /> : <NotFound />}
      </Route>

      <Route path="/trading">
        {isAuthenticated ? <TradingPage /> : <Login />}
      </Route>

      <Route path="/trading/">
        {isAuthenticated ? <TradingPage /> : <Login />}
      </Route>

      <Route path="/budget">
        {isAuthenticated ? <BudgetPage /> : <Login />}
      </Route>

      <Route path="/budget/">
        {isAuthenticated ? <BudgetPage /> : <Login />}
      </Route>

      <Route path="/workspaces/:workspace/tools/:id">
        {isAuthenticated ? <FlowDetailPage /> : <Login />}
      </Route>

      <Route path="/workspace">
        {isAuthenticated ? <WorkspacePage /> : <Login />}
      </Route>

      <Route path="/workspaces/:workspace">
        {isAuthenticated ? <WorkspacePage /> : <Login />}
      </Route>

      <Route path="/history/:runId">
        {isAuthenticated ? <RunDetailPage /> : <Login />}
      </Route>

      <Route path="/history">
        {isAuthenticated ? <HistoryPage /> : <Login />}
      </Route>

      <Route path="/inbox">
        {isAuthenticated ? <InboxPage /> : <Login />}
      </Route>

      <Route path="/flows">
        {isAuthenticated ? <FlowsPage /> : <Login />}
      </Route>

      <Route path="/flows/:id">
        {isAuthenticated ? <FlowDetailPage /> : <Login />}
      </Route>

      <Route path="/runs">
        {isAuthenticated ? <RunsListPage /> : <Login />}
      </Route>

      <Route path="/runs/:runId">
        {isAuthenticated ? <RunDetailPage /> : <Login />}
      </Route>

      <Route path="/projects">
        {isAuthenticated ? <ProjectsPage /> : <Login />}
      </Route>

      <Route path="/projects/:id">
        {isAuthenticated ? <ProjectDetailPage /> : <Login />}
      </Route>

      <Route path="/learning/studio">
        {isAuthenticated ? <LearningStudioPage /> : <Login />}
      </Route>

      <Route path="/learning/paths/:id">
        {isAuthenticated ? <LearningStudioPage /> : <Login />}
      </Route>

      <Route path="/learning">
        {isAuthenticated ? <LearningPage /> : <Login />}
      </Route>

      <Route path="/decisions">
        {isAuthenticated ? <DecisionsListPage /> : <Login />}
      </Route>

      <Route path="/decisions/:id">
        {isAuthenticated ? <DecisionDetailPage /> : <Login />}
      </Route>

      <Route path="/timeline">
        {isAuthenticated ? <TimelinePage /> : <Login />}
      </Route>

      <Route path="/discovery">
        {isAuthenticated ? <DiscoveryPage /> : <Login />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function NexusChatRoute() {
  const { id } = useParams<{ id?: string }>();
  const conversationId = !id || id === "undefined" || id === "null" ? null : id;
  return <NexusRootPage communicationConversationId={conversationId} />;
}

function GlobalErrorHooks() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void logClientRuntime({
        level: "error",
        event: "window.error",
        detail: event.message,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      void logClientRuntime({
        level: "error",
        event: "window.unhandledrejection",
        detail: String(event.reason),
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <NexusProvider>
              <GlobalErrorHooks />
              <Toaster />
              <Router />
            </NexusProvider>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
