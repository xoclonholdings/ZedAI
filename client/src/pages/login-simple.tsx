import React from 'react'
import { useAuth } from '../hooks/useAuthProvider'
import { ZedLogo } from '../components/ui/zed-logo'

export default function LoginSimple() {
    const { login } = useAuth()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const email = formData.get('email') as string
        const password = formData.get('password') as string

        try {
            await login(email, password)
        } catch (error) {
            console.error('Login failed:', error)
        }
    }

    return (
        <div className="min-h-screen bg-black cyberpunk-bg flex items-center justify-center relative overflow-hidden">
            {/* Cyberpunk grid background */}
            <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0" style={{
                    backgroundImage: `
                        linear-gradient(rgba(147,51,234,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(147,51,234,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '30px 30px'
                }}></div>
            </div>

            {/* Glowing orbs */}
            <div className="absolute top-20 right-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-20 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl"></div>

            <div className="w-full max-w-md p-8 bg-gray-900/50 rounded-lg border border-purple-500/30 backdrop-blur-sm shadow-2xl shadow-purple-500/10 relative z-10">
                <div className="flex items-center justify-center space-x-3 mb-8">
                    <ZedLogo className="w-10 h-10" />
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-orbitron tracking-wider">
                        ZED
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-white mb-2 font-space-grotesk font-medium">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 font-inter"
                            placeholder="admin@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-white mb-2 font-space-grotesk font-medium">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            className="w-full px-4 py-3 bg-gray-800/70 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 font-inter"
                            placeholder="Zed2025"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white rounded-lg transition-all duration-300 font-space-grotesk font-semibold tracking-wide shadow-lg shadow-purple-500/25 transform hover:scale-[1.02]"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    )
}
