import { createContext, useContext, useState, ReactNode } from 'react'

interface User {
    id: string
    email: string
    name: string
}

interface AuthContextType {
    user: User | null
    login: (email: string, password: string) => Promise<void>
    logout: () => void
    isAuthenticated: boolean
    isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

interface AuthProviderProps {
    children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    const login = async (email: string, password: string) => {
        setIsLoading(true)
        try {
            // Mock login - replace with actual API call
            await new Promise(resolve => setTimeout(resolve, 1000))
            // Use password in mock logic to avoid unused variable error
            if (password.length < 1) {
                throw new Error('Password cannot be empty')
            }
            setUser({
                id: '1',
                email,
                name: email.split('@')[0]
            })
        } finally {
            setIsLoading(false)
        }
    }

    const logout = () => {
        setUser(null)
    }

    const value: AuthContextType = {
        user,
        login,
        logout,
        isAuthenticated: !!user,
        isLoading
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}
