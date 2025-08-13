
import { Router, Route, Switch } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuthProvider.tsx';
import { Toaster } from './components/ui/toaster-simple';
import { Suspense, lazy } from 'react';

// Only advanced UI pages
const ChatFullPage = lazy(() => import('./pages/chat-full'));
const LandingPage = lazy(() => import('./pages/landing-onboarding'));

const LoadingSpinner = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const NotFoundPage = () => (
  <div className="min-h-screen bg-black cyberpunk-bg flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-white mb-4">404 - Page Not Found</h1>
      <p className="text-gray-400">The page you're looking for doesn't exist.</p>
    </div>
  </div>
);

const ChatFullPageWrapper = () => <ChatFullPage isMobile={false} />;


function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-black cyberpunk-bg">
            <Suspense fallback={<LoadingSpinner />}>
              <Switch>
                {/* Only advanced UI routes */}
                <Route path="/" component={LandingPage} />
                <Route path="/chat" component={ChatFullPageWrapper} />
                {/* 404 route */}
                <Route component={NotFoundPage} />
              </Switch>
            </Suspense>
            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App
