import { useLocation } from 'wouter'
import { ZedLogo } from '../components/ui/zed-logo'

export default function Onboarding() {
    const [, setLocation] = useLocation()

    return (
        <div className="h-screen bg-black cyberpunk-bg relative overflow-hidden flex flex-col">
            {/* Cyberpunk grid background */}
            <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 cyberpunk-grid-bg"></div>
            </div>

            {/* Glowing orbs */}
            <div className="absolute top-10 right-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-10 left-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl"></div>

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
                        </div>
                    </div>
                </header>

                {/* Main Content - Flex grow to fill remaining space */}
                <main className="flex-1 flex items-center justify-center px-6">
                    <div className="text-center max-w-2xl mx-auto">
                        {/* Logo and Brand */}
                        <div className="flex items-center justify-center space-x-6 mb-6">
                            <ZedLogo className="w-16 h-16 drop-shadow-2xl" />
                            <h1 className="text-5xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-orbitron tracking-wider">
                                ZED
                            </h1>
                        </div>

                        <h2 className="text-3xl font-bold text-white mb-4 font-space-grotesk leading-tight">
                            User Onboarding
                        </h2>

                        <div className="bg-gray-900/50 rounded-lg border border-purple-500/30 backdrop-blur-sm p-8 mb-6">
                            <p className="text-gray-300 text-lg font-inter mb-4">
                                🚧 Onboarding Page Placeholder 🚧
                            </p>
                            <p className="text-gray-400 text-sm font-inter">
                                This page is ready for onboarding specifications to be added.
                                The cyberpunk design system is in place and the layout is optimized for above-the-fold content.
                            </p>
                        </div>

                        <div className="space-x-4">
                            <button
                                onClick={() => setLocation('/')}
                                className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800/50 hover:text-white hover:border-gray-500 transition-all duration-300 font-space-grotesk text-sm"
                            >
                                Back to Home
                            </button>
                            <button
                                onClick={() => setLocation('/chat')}
                                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-700 hover:to-cyan-700 transition-all duration-300 shadow-lg shadow-purple-500/25 font-space-grotesk text-sm"
                            >
                                Skip to Chat
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
