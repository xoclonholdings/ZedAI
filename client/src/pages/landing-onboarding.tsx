import { useLocation } from 'wouter'
import { ZedLogo } from '../components/ui/zed-logo'

export default function LandingOnboarding() {
    const [, setLocation] = useLocation();
    return (
        <div className="h-screen bg-black relative overflow-hidden flex flex-col">
            {/* Multi-layered Animated Background */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Layer 1 - Main orbs */}
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000"></div>
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
            {/* Hero Section - Enhanced with depth layers */}
            <main className="flex-1 flex items-center justify-center px-4 relative">
                {/* Main content container with glass effect */}
                <div className="text-center max-w-4xl mx-auto relative">
                    {/* Background glass panel */}
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl -m-8 transform perspective-1000 rotate-x-2"></div>
                    {/* Content with layered depth */}
                    <div className="relative z-10 p-8">
                        {/* Logo and Brand with 3D effect */}
                        <div className="flex items-center justify-center mb-6 transform perspective-1000">
                            <h1 className="text-5xl lg:text-7xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-space-grotesk tracking-widest drop-shadow-2xl transform hover:scale-110 transition-transform duration-500 cursor-default">
                                ZED
                            </h1>
                            <div className="ml-0 -mt-4 lg:-mt-6 transform hover:rotate-12 transition-transform duration-300">
                                <ZedLogo className="w-8 h-8 lg:w-10 h-10 drop-shadow-2xl filter brightness-110" />
                            </div>
                        </div>
                        {/* Subtitle with layered shadow */}
                        <h2 className="text-2xl lg:text-4xl font-black text-white mb-4 font-space-grotesk leading-tight tracking-wide drop-shadow-lg transform hover:scale-105 transition-transform duration-300 cursor-default">
                            Welcome to the Future of
                            <span className="block bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent font-black tracking-wider drop-shadow-xl">
                                Artificial Intelligence
                            </span>
                        </h2>
                        {/* Description with floating effect */}
                        <div className="relative mb-8">
                            <p className="text-lg lg:text-xl text-gray-200 max-w-3xl mx-auto leading-relaxed font-inter font-bold tracking-wide drop-shadow-md transform hover:translate-y-1 transition-transform duration-300 cursor-default relative z-10">
                                Experience next-generation artificial intelligence with advanced chat capabilities,
                                intelligent memory systems, and seamless satellite connectivity for global reach.
                            </p>
                            {/* Floating highlight effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-pink-500/10 rounded-2xl blur-xl -z-10 transform scale-110"></div>
                        </div>
                        {/* CTA Button with enhanced 3D effect */}
                        <div className="max-w-xs mx-auto relative">
                            {/* Button glow background */}
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl blur-xl opacity-50 transform scale-110 animate-pulse"></div>
                            <button
                                onClick={() => setLocation('/chat')}
                                className="relative w-full px-8 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 text-white rounded-xl text-xl font-black hover:from-purple-700 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-2xl shadow-purple-500/40 hover:shadow-purple-500/60 font-space-grotesk tracking-widest drop-shadow-lg border border-white/20 backdrop-blur-sm btn-depth-shadow"
                            >
                                ENTER
                            </button>
                        </div>
                    </div>
                    {/* Floating elements around the main content */}
                    <div className="absolute -top-4 -left-4 w-6 h-6 bg-purple-400 rounded-full opacity-60 animate-pulse blur-sm"></div>
                    <div className="absolute -top-2 -right-8 w-4 h-4 bg-cyan-400 rounded-full opacity-50 animate-pulse blur-sm animation-delay-1000"></div>
                    <div className="absolute -bottom-6 -left-8 w-5 h-5 bg-pink-400 rounded-full opacity-40 animate-pulse blur-sm animation-delay-2000"></div>
                    <div className="absolute -bottom-4 -right-4 w-3 h-3 bg-purple-300 rounded-full opacity-70 animate-pulse blur-sm animation-delay-3000"></div>
                </div>
            </main>
        </div>
    );
}
