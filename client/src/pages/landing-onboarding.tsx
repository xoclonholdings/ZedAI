import { useLocation } from 'wouter'
import { ZedLogo } from '../components/ui/zed-logo'

export default function LandingOnboarding() {
    const [, setLocation] = useLocation()

    return (
        <div className="min-h-screen bg-black cyberpunk-bg">
            <div className="relative z-10">
                {/* Header */}
                <header className="p-6">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <ZedLogo className="w-8 h-8" />
                            <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
                                ZED
                            </div>
                        </div>
                        <div className="space-x-4">
                            <button
                                onClick={() => setLocation('/login')}
                                className="px-6 py-2 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/10 transition-colors"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => setLocation('/login')}
                                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                Sign Up
                            </button>
                        </div>
                    </div>
                </header>

                {/* Hero Section */}
                <main className="max-w-4xl mx-auto px-6 py-20">
                    <div className="text-center">
                        {/* Logo and Brand */}
                        <div className="flex items-center justify-center space-x-4 mb-8">
                            <ZedLogo className="w-24 h-24" />
                            <h1 className="text-8xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
                                ZED
                            </h1>
                        </div>

                        <h2 className="text-4xl font-bold text-white mb-6">
                            Welcome to the Future of AI
                        </h2>

                        <p className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto">
                            Experience next-generation artificial intelligence with advanced chat capabilities,
                            memory systems, and cyberpunk-inspired interface design.
                        </p>

                        <div className="space-y-4">
                            <button
                                onClick={() => setLocation('/chat')}
                                className="block w-full max-w-md mx-auto px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg text-lg font-semibold hover:from-purple-700 hover:to-cyan-700 transition-all transform hover:scale-105"
                            >
                                Enter
                            </button>

                            <button
                                onClick={() => setLocation('/chat')}
                                className="block w-full max-w-md mx-auto px-8 py-4 border border-gray-600 text-gray-300 rounded-lg text-lg hover:bg-gray-800 hover:text-white transition-all"
                            >
                                Skip Onboarding
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
