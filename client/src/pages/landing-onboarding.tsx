import { useLocation } from 'wouter'
import { ZedLogo } from '../components/ui/zed-logo'

export default function LandingOnboarding() {
    const [, setLocation] = useLocation()

    return (
        <div className="h-screen bg-black relative overflow-hidden flex flex-col">
            {/* Animated Background Orbs */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000"></div>
            </div>

            <div className="relative z-10 flex flex-col h-full">
                {/* Header */}
                <header className="p-3">
                    <div className="max-w-7xl mx-auto flex justify-between items-center">
                        <div className="flex items-center">
                            <h1 className="text-lg font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-space-grotesk tracking-widest drop-shadow-lg">
                                ZED
                            </h1>
                            <div className="ml-0 -mt-1">
                                <ZedLogo className="w-3 h-3" />
                            </div>
                        </div>
                        <div className="space-x-2">
                            <button
                                onClick={() => setLocation('/login')}
                                className="px-4 py-2 border-2 border-purple-500 text-purple-400 rounded-lg hover:bg-purple-500/10 transition-all duration-300 font-space-grotesk font-black text-xs tracking-wide backdrop-blur-sm"
                            >
                                Login
                            </button>
                            <button
                                onClick={() => setLocation('/onboarding')}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-lg hover:from-purple-700 hover:to-cyan-700 transition-all duration-300 shadow-lg shadow-purple-500/25 font-space-grotesk font-black text-xs tracking-wide"
                            >
                                Sign Up
                            </button>
                        </div>
                    </div>
                </header>

                {/* Hero Section - Flex grow to fill remaining space */}
                <main className="flex-1 flex items-center justify-center px-4">
                    <div className="text-center max-w-4xl mx-auto">
                        {/* Logo and Brand */}
                        <div className="flex items-center justify-center mb-6">
                            <h1 className="text-5xl lg:text-7xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-space-grotesk tracking-widest drop-shadow-2xl">
                                ZED
                            </h1>
                            <div className="ml-0 -mt-4 lg:-mt-6">
                                <ZedLogo className="w-8 h-8 lg:w-10 h-10 drop-shadow-2xl" />
                            </div>
                        </div>

                        <h2 className="text-2xl lg:text-4xl font-black text-white mb-4 font-space-grotesk leading-tight tracking-wide drop-shadow-lg">
                            Welcome to the Future of
                            <span className="block bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent font-black tracking-wider">
                                Artificial Intelligence
                            </span>
                        </h2>

                        <p className="text-lg lg:text-xl text-gray-200 mb-8 max-w-3xl mx-auto leading-relaxed font-inter font-bold tracking-wide drop-shadow-md">
                            Experience next-generation artificial intelligence with advanced chat capabilities,
                            intelligent memory systems, and seamless satellite connectivity for global reach.
                        </p>

                        <div className="max-w-xs mx-auto">
                            <button
                                onClick={() => setLocation('/chat')}
                                className="w-full px-8 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-xl text-xl font-black hover:from-purple-700 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105 shadow-xl shadow-purple-500/30 font-space-grotesk tracking-widest drop-shadow-lg"
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
