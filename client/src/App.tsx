import { Router, Route, Switch } from 'wouter'
import { AuthProvider } from './hooks/useAuthProvider'
import { Toaster } from './components/ui/toaster-simple'

// Pages
import LoginPage from './pages/login-simple'
import ChatPage from './pages/chat-full'
import LandingPage from './pages/landing-onboarding'
import OnboardingPage from './pages/onboarding'
import NotFoundPage from './pages/not-found'

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-black cyberpunk-bg">
          <Switch>
            {/* Public routes */}
            <Route path="/login" component={LoginPage} />
            <Route path="/onboarding" component={OnboardingPage} />
            <Route path="/" component={LandingPage} />

            {/* Chat routes - accessible without authentication for demo */}
            <Route path="/chat/:id?" component={ChatPage} />

            {/* 404 route */}
            <Route component={NotFoundPage} />
          </Switch>

          <Toaster />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
