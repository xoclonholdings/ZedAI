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
        <div className="min-h-screen bg-black cyberpunk-bg flex items-center justify-center">
            <div className="w-full max-w-md p-8 bg-gray-900/50 rounded-lg border border-purple-500/30">
                <div className="flex items-center justify-center space-x-3 mb-6">
                    <ZedLogo className="w-8 h-8" />
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
                        ZED
                    </h1>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-white mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                            placeholder="admin@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-white mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            required
                            className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                            placeholder="Zed2025"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                    >
                        Login
                    </button>
                </form>
            </div>
        </div>
    )
}
