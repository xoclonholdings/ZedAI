import { useLocation } from 'wouter'
import { ZedLogo } from '../components/ui/zed-logo'

export default function LandingOnboarding() {
    const [, setLocation] = useLocation()

    return (
        <div className="min-h-screen bg-black cyberpunk-bg relative overflow-hidden">
            {/* Cyberpunk grid background */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0" style={{
                    backgroundImage: `
                        linear-gradient(rgba(147,51,234,0.1) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(147,51,234,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: '50px 50px'
                }}></div>
            </div>

            {/* Glowing orbs */}
            <div className="absolute top-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>

            <div className="relative z-10">
                {/* Header */}
                <header className="p-6">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <ZedLogo className="w-8 h-8" />
                            <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-orbitron tracking-wider">
                                ZED
                            </div>
                        </div>
                        <div className="space-x-4">
                            <button
                                onClick={() => setLocation('/login')}
                                className="px-6 py-2 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/10 transition-all duration-300 font-space-grotesk font-medium"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => setLocation('/login')}
                                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-700 hover:to-cyan-700 transition-all duration-300 shadow-lg shadow-purple-500/25 font-space-grotesk font-medium"
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
                        <div className="flex items-center justify-center space-x-6 mb-12">
                            <ZedLogo className="w-32 h-32 drop-shadow-2xl" />
                            <h1 className="text-9xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-orbitron tracking-wider">
                                ZED
                            </h1>
                        </div>

                        <h2 className="text-5xl font-bold text-white mb-8 font-space-grotesk leading-tight">
                            Welcome to the Future of
                            <span className="block bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                                Artificial Intelligence
                            </span>
                        </h2>

                        <p className="text-xl text-gray-300 mb-16 max-w-3xl mx-auto leading-relaxed font-inter">
                            Experience next-generation artificial intelligence with advanced chat capabilities,
                            intelligent memory systems, and a cutting-edge cyberpunk-inspired interface.
                        </p>

                        <div className="space-y-4 max-w-md mx-auto">
                            <button
                                onClick={() => setLocation('/chat')}
                                className="block w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg text-lg font-semibold hover:from-purple-700 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105 shadow-xl shadow-purple-500/25 font-space-grotesk tracking-wide"
                            >
                                Enter ZED
                            </button>

                            <button
                                onClick={() => setLocation('/chat')}
                                className="block w-full px-8 py-4 border border-gray-600 text-gray-300 rounded-lg text-lg hover:bg-gray-800/50 hover:text-white hover:border-gray-500 transition-all duration-300 backdrop-blur-sm font-space-grotesk tracking-wide"
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
