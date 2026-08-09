import { Component, type ReactNode, useEffect } from "react";
import { Switch, Route, useLocation, useParams } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/components/auth/UseAuth";
import { PrivyAuthRoot } from "@/components/auth/PrivyAuthRoot";
import { installApiFetchPatch } from "@/lib/apiClient";
import { logClientRuntime } from "@/lib/runtimeLogger";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Admin from "@/pages/admin";
import HomePage from "@/pages/home";
import NexysRootPage from "@/nexys/pages/NexysRootPage";
import ZebulonConstellationPage from "@/zebulon/ZebulonConstellationPage";
import GalaxyWorkspacePage from "@/zebulon/GalaxyWorkspacePage";
import { NexysProvider } from "@/nexys";
import { ConsoleWorkspaceFrame } from "@/console/ConsoleWorkspaceFrame";
import FlowsPage from "@/pages/flows";
import FlowDetailPage from "@/pages/flow-detail";
import { RunDetailPage } from "@/pages/runs";
import ProjectDetailPage from "@/pages/project-detail";
import ProjectsPage from "@/pages/projects";
import { DecisionsListPage, DecisionDetailPage } from "@/pages/decisions";
import TimelinePage from "@/pages/timeline";
import DiscoveryPage from "@/pages/discovery";
import CapitalRedirect from "@/pages/CapitalRedirect";
import WorkspacePage from "@/pages/workspace";
import HistoryPage from "@/pages/history";
import InboxPage from "@/pages/inbox";
import LearningStudioPage from "@/pages/learning-studio";
import SettingsPage from "@/pages/settings";
import ConnectPage from "@/pages/connect";
import IdentityPage from "@/pages/identity";
import ChatPage from "@/pages/chat";
import KnowledgePage from "@/pages/knowledge";

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

/** Client-side redirect for a route that merged into another (e.g. /runs -> /history). */
function RedirectTo({ to }: { readonly to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [to, navigate]);
  return null;
}

function RedirectRunToHistory() {
  const { runId } = useParams<{ runId?: string }>();
  return <RedirectTo to={`/history/${runId ?? ""}`} />;
}

function Router() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? <ZebulonConstellationPage /> : <Login />}
      </Route>

      <Route path="/chat/:id?">
        {isAuthenticated ? (
          <ConsoleWorkspaceFrame label="Chat" accent="#c084fc" flush>
            <ChatPage />
          </ConsoleWorkspaceFrame>
        ) : (
          <Login />
        )}
      </Route>

      <Route path="/home">
        {isAuthenticated ? <NexysRootPage /> : <Login />}
      </Route>

      <Route path="/nexys">
        {isAuthenticated ? <NexysRootPage /> : <Login />}
      </Route>

      <Route path="/nexys/:nodeId/:view?">
        {isAuthenticated ? <NexysRootPage /> : <Login />}
      </Route>

      <Route path="/galaxy/:id">
        {isAuthenticated ? <GalaxyWorkspacePage /> : <Login />}
      </Route>

      <Route path="/knowledge-map">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="knowledge"><HomePage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/admin">
        {!isAuthenticated ? <Login /> : isAdmin ? <Admin /> : <NotFound />}
      </Route>

      <Route path="/trading">
        {isAuthenticated ? <CapitalRedirect path="/trading" /> : <Login />}
      </Route>

      <Route path="/trading/">
        {isAuthenticated ? <CapitalRedirect path="/trading" /> : <Login />}
      </Route>

      <Route path="/budget">
        {isAuthenticated ? <CapitalRedirect path="/budget" /> : <Login />}
      </Route>

      <Route path="/budget/">
        {isAuthenticated ? <CapitalRedirect path="/budget" /> : <Login />}
      </Route>

      <Route path="/workspaces/:workspace/tools/:id">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="workspaces"><FlowDetailPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/workspace">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="workspaces"><WorkspacePage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/workspaces/finance">
        {isAuthenticated ? <CapitalRedirect path="/" /> : <Login />}
      </Route>

      <Route path="/workspaces/trading">
        {isAuthenticated ? <CapitalRedirect path="/trading" /> : <Login />}
      </Route>

      <Route path="/workspaces/:workspace">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="workspaces"><WorkspacePage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/history/:runId">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="tools"><RunDetailPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/history">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="tools"><HistoryPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/inbox">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="connect"><InboxPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/flows">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="tools"><FlowsPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/flows/:id">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="tools"><FlowDetailPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      {/* /runs merged into /history — same flow-run data, one real page instead of two. */}
      <Route path="/runs">
        <RedirectTo to="/history" />
      </Route>

      <Route path="/runs/:runId">
        <RedirectRunToHistory />
      </Route>

      <Route path="/projects">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="projects"><ProjectsPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/settings">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="settings"><SettingsPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/connect">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="connect"><ConnectPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/identity">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="identity"><IdentityPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/knowledge">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="knowledge"><KnowledgePage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/projects/:id">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="projects"><ProjectDetailPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/learning/studio">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="memory"><LearningStudioPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/learning/paths/:id">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="memory"><LearningStudioPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      {/* Legacy route: the old Memory "Learning" page merged into Knowledge (see knowledge.tsx). */}
      <Route path="/learning">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="knowledge"><KnowledgePage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/decisions">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="knowledge"><DecisionsListPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/decisions/:id">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="knowledge"><DecisionDetailPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/timeline">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="knowledge"><TimelinePage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route path="/discovery">
        {isAuthenticated ? <ConsoleWorkspaceFrame nodeId="knowledge"><DiscoveryPage /></ConsoleWorkspaceFrame> : <Login />}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
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
        <PrivyAuthRoot>
          <TooltipProvider>
            <NexysProvider>
              <GlobalErrorHooks />
              <Toaster />
              <Router />
            </NexysProvider>
          </TooltipProvider>
        </PrivyAuthRoot>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
