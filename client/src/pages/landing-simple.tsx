import { useLocation } from 'wouter'
import { ZedLogo } from '../components/ui/zed-logo'

export default function LandingSimple() {
    const [, setLocation] = useLocation()

    return (
        <div className="min-h-screen bg-black cyberpunk-bg">
            <div className="relative z-10">
                {/* Header */}
                <header className="p-6">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                            <ZedLogo className="w-8 h-8" />
                            <div className="text-2xl font-bold gradient-text">
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
                            <h1 className="text-8xl font-bold gradient-text">
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
<div className="grid md:grid-cols-3 gap-8 mt-20">
    <div className="p-6 bg-gray-900/50 rounded-lg border border-cyan-500/30">
        <h3 className="text-xl font-bold text-cyan-400 mb-4">
            Real-time Chat
        </h3>
        <p className="text-gray-300">
            Engage in seamless conversations with advanced AI capabilities.
        </p>
    </div>

    <div className="p-6 bg-gray-900/50 rounded-lg border border-purple-500/30">
        <h3 className="text-xl font-bold text-purple-400 mb-4">
            Memory Systems
        </h3>
        <p className="text-gray-300">
            Persistent memory that learns and adapts to your preferences.
        </p>
    </div>

    <div className="p-6 bg-gray-900/50 rounded-lg border border-pink-500/30">
        <h3 className="text-xl font-bold text-pink-400 mb-4">
            Cyberpunk Interface
        </h3>
        <p className="text-gray-300">
            Immersive futuristic design for the ultimate AI experience.
        </p>
    </div>
</div>
                </main >
            </div >
        </div >
    )
}
