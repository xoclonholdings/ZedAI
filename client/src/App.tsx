import { Router, Route, Switch } from 'wouter'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './hooks/useAuthProvider.tsx'
import { Toaster } from './components/ui/toaster-simple'

// Pages
import LoginPage from './pages/login-simple'
import ComprehensiveChatPage from './pages/comprehensive-chat-simple'
import ChatFullPage from './pages/chat-full'
import LandingPage from './pages/landing-onboarding'
import OnboardingPage from './pages/onboarding'

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

// Simple 404 component
const NotFoundPage = () => (
  <div className="min-h-screen bg-black cyberpunk-bg flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-white mb-4">404 - Page Not Found</h1>
      <p className="text-gray-400">The page you're looking for doesn't exist.</p>
    </div>
  </div>
)

// Wrapper for ChatFullPage to handle props
const ChatFullPageWrapper = () => <ChatFullPage isMobile={false} />

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-black cyberpunk-bg">
            <Switch>
              {/* Public routes */}
              <Route path="/login" component={LoginPage} />
              <Route path="/onboarding" component={OnboardingPage} />
              <Route path="/" component={LandingPage} />

              {/* Chat routes - accessible without authentication for demo */}
              <Route path="/chat/comprehensive" component={ComprehensiveChatPage} />
              <Route path="/chat" component={ChatFullPageWrapper} />

              {/* 404 route */}
              <Route component={NotFoundPage} />
            </Switch>

            <Toaster />
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
