import React, { ReactNode } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '../../hooks/useAuthProvider'

interface AuthGuardProps {
    children: ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
    const { isAuthenticated, isLoading } = useAuth()
    const [, setLocation] = useLocation()

    // Show loading while checking authentication
    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Checking authentication...</p>
                </div>
            </div>
        )
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        setLocation('/login')
        return null
    }

    return <>{children}</>
}
