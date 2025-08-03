import React from 'react'
import { Router, Route, Switch } from 'wouter'
import { AuthProvider } from './hooks/useAuthProvider'
import { Toaster } from './components/ui/toaster'

// Pages
import LoginPage from './pages/login'
import ChatPage from './pages/chat'
import LandingPage from './pages/landing'
import NotFoundPage from './pages/not-found'

// Components
import AuthGuard from './components/auth/AuthGuard'

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="min-h-screen bg-black cyberpunk-bg">
                    <Switch>
                        {/* Public routes */}
                        <Route path="/login" component={LoginPage} />
                        <Route path="/" component={LandingPage} />

                        {/* Protected routes */}
                        <Route path="/chat">
                            <AuthGuard>
                                <ChatPage />
                            </AuthGuard>
                        </Route>

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
