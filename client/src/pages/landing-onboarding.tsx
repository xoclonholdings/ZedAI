import { useLocation } from 'wouter'
import { ZedLogo } from '../components/ui/zed-logo'

export default function LandingOnboarding() {
    const [, setLocation] = useLocation()

    return (
        <div className="h-screen bg-black cyberpunk-bg relative overflow-hidden flex flex-col">
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
            <div className="absolute top-10 right-10 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 left-10 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl"></div>

            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <header className="p-4">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <ZedLogo className="w-6 h-6" />
                            <div className="text-xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-orbitron tracking-wider">
                                ZED
                            </div>
                        </div>
                        <div className="space-x-3">
                            <button
                                onClick={() => setLocation('/login')}
                                className="px-4 py-2 border border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/10 transition-all duration-300 font-space-grotesk font-medium text-sm"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => setLocation('/login')}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-700 hover:to-cyan-700 transition-all duration-300 shadow-lg shadow-purple-500/25 font-space-grotesk font-medium text-sm"
                            >
                                Sign Up
                            </button>
                        </div>
                    </div>
                </header>

                {/* Hero Section - Flex grow to fill remaining space */}
                <main className="flex-1 flex items-center justify-center px-6">
                    <div className="text-center max-w-4xl mx-auto">
                        {/* Logo and Brand */}
                        <div className="flex items-center justify-center space-x-6 mb-6">
                            <ZedLogo className="w-20 h-20 drop-shadow-2xl" />
                            <h1 className="text-6xl lg:text-7xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-orbitron tracking-wider">
                                ZED
                            </h1>
                        </div>

                        <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4 font-space-grotesk leading-tight">
                            Welcome to the Future of
                            <span className="block bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                                Artificial Intelligence
                            </span>
                        </h2>

                        <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed font-inter">
                            Experience next-generation artificial intelligence with advanced chat capabilities,
                            intelligent memory systems, and a cutting-edge cyberpunk-inspired interface.
                        </p>

                        <div className="max-w-sm mx-auto">
                            <button
                                onClick={() => setLocation('/chat')}
                                className="w-full px-8 py-4 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg text-lg font-semibold hover:from-purple-700 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105 shadow-xl shadow-purple-500/25 font-space-grotesk tracking-wide"
                            >
                                ENTER
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
