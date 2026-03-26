import { useState } from 'react'
import { useLocation } from 'wouter'
import { ZedLogo } from '../components/ui/zed-logo'
import { useAuth } from '../hooks/useAuthProvider.tsx'

export default function LoginSimple() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [, setLocation] = useLocation()
    const { login } = useAuth()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        try {
            await login(email, password)
            setLocation('/chat')
        } catch (error) {
            console.error('Login failed:', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-black cyberpunk-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Enhanced Multi-layered Background */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Layer 1 - Main orbs */}
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>

                {/* Layer 2 - Secondary orbs for depth */}
                <div className="absolute top-20 right-1/4 w-40 h-40 bg-purple-400 rounded-full mix-blend-multiply filter blur-2xl opacity-15 animate-pulse animation-delay-1000"></div>
                <div className="absolute bottom-20 left-1/4 w-32 h-32 bg-cyan-400 rounded-full mix-blend-multiply filter blur-2xl opacity-15 animate-pulse animation-delay-3000"></div>

                {/* Layer 3 - Floating particles */}
                <div className="absolute top-1/3 left-1/5 w-4 h-4 bg-purple-300 rounded-full opacity-30 animate-bounce animation-delay-500"></div>
                <div className="absolute top-2/3 right-1/5 w-3 h-3 bg-cyan-300 rounded-full opacity-25 animate-bounce animation-delay-1500"></div>
                <div className="absolute top-1/2 left-3/4 w-2 h-2 bg-pink-300 rounded-full opacity-20 animate-bounce animation-delay-2500"></div>

                {/* Layer 4 - Grid overlay for depth */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0 depth-grid"></div>
                </div>
            </div>

            {/* Enhanced Login Container with Glass Effect */}
            <div className="w-full max-w-md relative z-10">
                {/* Background glass panel */}
                <div className="absolute inset-0 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl -m-4 transform perspective-1000 rotate-x-2"></div>

                <div className="relative z-10 p-8">
                    {/* Enhanced Header */}
                    <div className="text-center mb-8">
                        {/* Logo with glow effect */}
                        <div className="relative mb-4">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full blur-xl opacity-30 transform scale-150"></div>
                            <ZedLogo className="relative w-12 h-12 mx-auto drop-shadow-2xl transform hover:scale-110 transition-transform duration-500" />
                        </div>

                        <h1 className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-purple-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-lg transform hover:scale-105 transition-transform duration-300 cursor-default">
                            Welcome to ZED
                        </h1>
                        <p className="text-gray-300 drop-shadow-md">Sign in to your account</p>
                    </div>

                    {/* Enhanced Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="relative">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                                Email
                            </label>
                            <div className="relative">
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 transform hover:scale-[1.02] shadow-lg input-3d"
                                    placeholder="Enter your email"
                                />
                                {/* Floating highlight effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg blur-xl -z-10 transform scale-110 opacity-0 focus-within:opacity-100 transition-opacity duration-300"></div>
                            </div>
                        </div>

                        <div className="relative">
                            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2 tracking-wide">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="w-full px-4 py-3 bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300 transform hover:scale-[1.02] shadow-lg input-3d"
                                    placeholder="Enter your password"
                                />
                                {/* Floating highlight effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg blur-xl -z-10 transform scale-110 opacity-0 focus-within:opacity-100 transition-opacity duration-300"></div>
                            </div>
                        </div>

                        {/* Enhanced Submit Button */}
                        <div className="relative">
                            {/* Button glow background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg blur-xl opacity-50 transform scale-110 animate-pulse"></div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="relative w-full py-3 px-4 bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5 shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 border border-white/20 backdrop-blur-sm btn-depth-shadow"
                            >
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </div>
                    </form>

                    {/* Floating decorative elements */}
                    <div className="absolute -top-2 -left-2 w-4 h-4 bg-purple-400 rounded-full opacity-60 animate-pulse blur-sm"></div>
                    <div className="absolute -top-1 -right-4 w-3 h-3 bg-cyan-400 rounded-full opacity-50 animate-pulse blur-sm animation-delay-1000"></div>
                    <div className="absolute -bottom-3 -left-4 w-2 h-2 bg-pink-400 rounded-full opacity-40 animate-pulse blur-sm animation-delay-2000"></div>
                </div>
            </div>
        </div>
    )
}
