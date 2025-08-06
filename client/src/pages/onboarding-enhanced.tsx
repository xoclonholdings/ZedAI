import { useState } from 'react'
import { useLocation } from 'wouter'
import { ZedLogo } from '../components/ui/zed-logo'
import {
    User,
    Mail,
    Lock,
    Sparkles,
    MessageSquare,
    FileText,
    Rss,
    Shield,
    ChevronRight,
    ChevronLeft,
    Check
} from 'lucide-react'

interface OnboardingStep {
    id: number
    title: string
    description: string
    component: JSX.Element
}

export default function Onboarding() {
    const [, setLocation] = useLocation()
    const [currentStep, setCurrentStep] = useState(0)
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        preferences: {
            aiConversations: true,
            documentProcessing: true,
            socialIntegration: false,
            notifications: true
        }
    })

    const updateFormData = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }))
    }

    const updatePreferences = (pref: string, value: boolean) => {
        setFormData(prev => ({
            ...prev,
            preferences: {
                ...prev.preferences,
                [pref]: value
            }
        }))
    }

    // Step 1: Welcome
    const WelcomeStep = () => (
        <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full flex items-center justify-center mb-4 shadow-lg transform hover:scale-110 transition-transform duration-300"
                style={{
                    boxShadow: `
                         0 0 30px rgba(139, 92, 246, 0.4),
                         0 10px 25px rgba(0, 0, 0, 0.3),
                         inset 0 1px 0 rgba(255, 255, 255, 0.2)
                     `
                }}>
                <Sparkles size={32} className="text-white drop-shadow-lg" />
            </div>
            <h3 className="text-xl font-black text-white font-space-grotesk tracking-wide transform hover:scale-105 transition-transform duration-300 cursor-default">
                Welcome to ZED AI
            </h3>
            <p className="text-sm text-gray-200 leading-relaxed font-inter font-bold drop-shadow-md">
                Your journey into the future of artificial intelligence begins here.
                Let's set up your account and customize your AI experience.
            </p>
        </div>
    )

    // Step 2: Account Creation
    const AccountStep = () => (
        <div className="space-y-3">
            <div className="text-center mb-3">
                <div className="relative mb-2">
                    <div className="absolute inset-0 bg-purple-500 rounded-full blur-lg opacity-30 transform scale-150"></div>
                    <User className="relative w-10 h-10 mx-auto text-purple-400 drop-shadow-lg" />
                </div>
                <h3 className="text-lg font-black text-white font-space-grotesk tracking-wide transform hover:scale-105 transition-transform duration-300 cursor-default">
                    Create Your Account
                </h3>
                <p className="text-xs text-gray-200 font-inter font-bold drop-shadow-md">
                    Choose your username and secure your account
                </p>
            </div>

            <div className="space-y-2">
                <div className="relative">
                    <label className="block text-xs font-black text-gray-200 mb-1 font-space-grotesk tracking-wide">
                        Username
                    </label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 drop-shadow-sm" />
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => updateFormData('username', e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-gray-900/50 backdrop-blur-sm border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-inter text-sm shadow-lg transform hover:scale-[1.02]"
                            placeholder="Enter your username"
                            style={{
                                boxShadow: `
                                    0 0 20px rgba(139, 92, 246, 0.1),
                                    0 5px 15px rgba(0, 0, 0, 0.2),
                                    inset 0 1px 0 rgba(255, 255, 255, 0.1)
                                `
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg blur-xl -z-10 transform scale-110 opacity-0 focus-within:opacity-100 transition-opacity duration-300"></div>
                    </div>
                </div>

                <div className="relative">
                    <label className="block text-xs font-black text-gray-200 mb-1 font-space-grotesk tracking-wide">
                        Email
                    </label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 drop-shadow-sm" />
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => updateFormData('email', e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-gray-900/50 backdrop-blur-sm border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-inter text-sm shadow-lg transform hover:scale-[1.02]"
                            placeholder="Enter your email"
                            style={{
                                boxShadow: `
                                    0 0 20px rgba(139, 92, 246, 0.1),
                                    0 5px 15px rgba(0, 0, 0, 0.2),
                                    inset 0 1px 0 rgba(255, 255, 255, 0.1)
                                `
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg blur-xl -z-10 transform scale-110 opacity-0 focus-within:opacity-100 transition-opacity duration-300"></div>
                    </div>
                </div>

                <div className="relative">
                    <label className="block text-xs font-black text-gray-200 mb-1 font-space-grotesk tracking-wide">
                        Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 drop-shadow-sm" />
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => updateFormData('password', e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-gray-900/50 backdrop-blur-sm border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-inter text-sm shadow-lg transform hover:scale-[1.02]"
                            placeholder="Create a secure password"
                            style={{
                                boxShadow: `
                                    0 0 20px rgba(139, 92, 246, 0.1),
                                    0 5px 15px rgba(0, 0, 0, 0.2),
                                    inset 0 1px 0 rgba(255, 255, 255, 0.1)
                                `
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg blur-xl -z-10 transform scale-110 opacity-0 focus-within:opacity-100 transition-opacity duration-300"></div>
                    </div>
                </div>

                <div className="relative">
                    <label className="block text-xs font-black text-gray-200 mb-1 font-space-grotesk tracking-wide">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400 drop-shadow-sm" />
                        <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-gray-900/50 backdrop-blur-sm border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-inter text-sm shadow-lg transform hover:scale-[1.02]"
                            placeholder="Confirm your password"
                            style={{
                                boxShadow: `
                                    0 0 20px rgba(139, 92, 246, 0.1),
                                    0 5px 15px rgba(0, 0, 0, 0.2),
                                    inset 0 1px 0 rgba(255, 255, 255, 0.1)
                                `
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-lg blur-xl -z-10 transform scale-110 opacity-0 focus-within:opacity-100 transition-opacity duration-300"></div>
                    </div>
                </div>
            </div>
        </div>
    )

    // Step 3: Preferences
    const PreferencesStep = () => (
        <div className="space-y-3">
            <div className="text-center mb-3">
                <div className="relative mb-2">
                    <div className="absolute inset-0 bg-cyan-500 rounded-full blur-lg opacity-30 transform scale-150"></div>
                    <Sparkles className="relative w-10 h-10 mx-auto text-cyan-400 drop-shadow-lg" />
                </div>
                <h3 className="text-lg font-black text-white font-space-grotesk tracking-wide transform hover:scale-105 transition-transform duration-300 cursor-default">
                    Customize Your Experience
                </h3>
                <p className="text-xs text-gray-200 font-inter font-bold drop-shadow-md">
                    Choose which features you'd like to enable
                </p>
            </div>

            <div className="space-y-2">
                {[
                    { key: 'aiConversations', icon: MessageSquare, title: 'AI Conversations', desc: 'Enable intelligent chat' },
                    { key: 'documentProcessing', icon: FileText, title: 'Document Processing', desc: 'Upload and analyze files' },
                    { key: 'socialIntegration', icon: Rss, title: 'Social Integration', desc: 'Connect social feeds' },
                    { key: 'notifications', icon: Shield, title: 'Notifications', desc: 'Receive AI updates' }
                ].map(({ key, icon: Icon, title, desc }) => (
                    <div
                        key={key}
                        className="relative bg-gray-900/50 backdrop-blur-sm border border-purple-500/30 rounded-lg p-2.5 hover:border-purple-500/50 transition-all cursor-pointer transform hover:scale-[1.02] shadow-lg"
                        onClick={() => updatePreferences(key, !formData.preferences[key as keyof typeof formData.preferences])}
                        style={{
                            boxShadow: `
                                0 0 15px rgba(139, 92, 246, 0.1),
                                0 5px 15px rgba(0, 0, 0, 0.2),
                                inset 0 1px 0 rgba(255, 255, 255, 0.05)
                            `
                        }}
                    >
                        {/* Floating highlight effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-cyan-500/5 rounded-lg blur-sm opacity-0 hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="relative flex items-center space-x-3">
                            <div className="w-7 h-7 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300"
                                style={{
                                    boxShadow: `
                                         0 0 15px rgba(139, 92, 246, 0.2),
                                         0 3px 10px rgba(0, 0, 0, 0.2),
                                         inset 0 1px 0 rgba(255, 255, 255, 0.1)
                                     `
                                }}>
                                <Icon className="w-3.5 h-3.5 text-purple-400 drop-shadow-sm" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-black text-white font-space-grotesk tracking-wide text-sm drop-shadow-sm">{title}</h4>
                                <p className="text-xs text-gray-300 font-inter drop-shadow-sm">{desc}</p>
                            </div>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all transform hover:scale-110 shadow-lg ${formData.preferences[key as keyof typeof formData.preferences]
                                ? 'border-purple-500 bg-purple-500 shadow-purple-500/50'
                                : 'border-gray-500 shadow-gray-500/30'
                                }`}
                                style={{
                                    boxShadow: formData.preferences[key as keyof typeof formData.preferences]
                                        ? `0 0 15px rgba(139, 92, 246, 0.5), 0 3px 10px rgba(0, 0, 0, 0.3)`
                                        : `0 3px 10px rgba(0, 0, 0, 0.2)`
                                }}>
                                {formData.preferences[key as keyof typeof formData.preferences] && (
                                    <Check className="w-2.5 h-2.5 text-white drop-shadow-sm" />
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )

    // Step 4: Completion
    const CompletionStep = () => (
        <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-green-500 to-cyan-500 rounded-full flex items-center justify-center mb-4 shadow-lg transform hover:scale-110 transition-transform duration-300"
                style={{
                    boxShadow: `
                         0 0 30px rgba(34, 197, 94, 0.4),
                         0 10px 25px rgba(0, 0, 0, 0.3),
                         inset 0 1px 0 rgba(255, 255, 255, 0.2)
                     `
                }}>
                <Check size={32} className="text-white drop-shadow-lg" />
            </div>
            <h3 className="text-xl font-black text-white font-space-grotesk tracking-wide transform hover:scale-105 transition-transform duration-300 cursor-default">
                You're All Set!
            </h3>
            <p className="text-sm text-gray-200 leading-relaxed font-inter font-bold drop-shadow-md">
                Welcome to ZED AI! Your account has been configured and you're ready to experience
                the future of artificial intelligence.
            </p>
        </div>
    )

    const steps: OnboardingStep[] = [
        { id: 1, title: 'Welcome', description: 'Welcome to ZED', component: <WelcomeStep /> },
        { id: 2, title: 'Account', description: 'Create account', component: <AccountStep /> },
        { id: 3, title: 'Preferences', description: 'Set preferences', component: <PreferencesStep /> },
        { id: 4, title: 'Complete', description: 'Setup complete', component: <CompletionStep /> }
    ]

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            setLocation('/chat')
        }
    }

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const canProceed = () => {
        if (currentStep === 1) {
            return formData.username && formData.email && formData.password &&
                formData.password === formData.confirmPassword && formData.password.length >= 6
        }
        return true
    }

    const getProgressClass = () => {
        const progress = Math.round(((currentStep + 1) / steps.length) * 100)
        if (progress <= 25) return 'w-1/4'
        if (progress <= 50) return 'w-1/2'
        if (progress <= 75) return 'w-3/4'
        return 'w-full'
    }

    return (
        <div className="h-screen bg-black flex flex-col relative overflow-hidden">
            {/* Enhanced Multi-layered Background */}
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

            <div className="relative z-10 flex flex-col h-full">
                {/* Enhanced Header with Glass Effect */}
                <header className="p-2 relative">
                    {/* Glass backdrop */}
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-md border-b border-white/10"></div>

                    <div className="flex items-center justify-center relative z-10">
                        {/* Logo with glow effect */}
                        <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full blur-lg opacity-30 transform scale-150"></div>
                            <h1 className="relative text-2xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-space-grotesk tracking-widest drop-shadow-lg transform hover:scale-105 transition-transform duration-300 cursor-default">
                                ZED
                            </h1>
                        </div>
                        <div className="ml-0 -mt-1">
                            <ZedLogo className="w-4 h-4 drop-shadow-lg transform hover:rotate-12 transition-transform duration-300" />
                        </div>
                    </div>
                </header>

                {/* Enhanced Main Content */}
                <main className="flex-1 flex items-center justify-center px-4 py-2">
                    <div className="w-full max-w-lg relative">
                        {/* Background glass panel */}
                        <div className="absolute inset-0 bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl -m-4 transform perspective-1000 rotate-x-2"></div>

                        <div className="relative z-10 p-6">
                            {/* Enhanced Progress Indicator with 3D Effects */}
                            <div className="mb-4 relative">
                                {/* Background glow for progress section */}
                                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 rounded-xl blur-xl -z-10 transform scale-110"></div>

                                <div className="flex justify-between mb-2">
                                    {steps.map((step, index) => (
                                        <div key={step.id} className="flex flex-col items-center">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 transform hover:scale-110 shadow-lg ${index <= currentStep
                                                ? 'border-purple-500 bg-purple-500 text-white shadow-purple-500/50'
                                                : 'border-gray-600 text-gray-400 shadow-gray-600/30'
                                                }`}
                                                style={{
                                                    boxShadow: index <= currentStep
                                                        ? `0 0 20px rgba(139, 92, 246, 0.5), 0 5px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                                                        : `0 5px 15px rgba(0, 0, 0, 0.2)`
                                                }}>
                                                {index < currentStep ? (
                                                    <Check className="w-3 h-3 drop-shadow-sm" />
                                                ) : (
                                                    <span className="text-xs font-black drop-shadow-sm">{index + 1}</span>
                                                )}
                                            </div>
                                            <span className="text-xs text-gray-400 mt-1 font-space-grotesk font-black tracking-wide">
                                                {step.title}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Enhanced progress bar with glow */}
                                <div className="relative">
                                    <div className="w-full bg-gray-800/50 rounded-full h-1.5 backdrop-blur-sm border border-gray-700/50">
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-full blur-sm"></div>
                                        <div
                                            className={`relative bg-gradient-to-r from-purple-500 to-cyan-500 h-1.5 rounded-full transition-all duration-500 shadow-lg ${getProgressClass()}`}
                                            style={{
                                                boxShadow: `
                                                    0 0 15px rgba(139, 92, 246, 0.6),
                                                    0 0 30px rgba(6, 182, 212, 0.4)
                                                `
                                            }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Step Content Container */}
                            <div className="relative mb-4">
                                {/* Content glow background */}
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-xl blur-xl transform scale-105"></div>

                                <div className="relative bg-gray-900/40 backdrop-blur-md border border-purple-500/30 rounded-xl p-4 shadow-2xl"
                                    style={{
                                        boxShadow: `
                                             0 0 30px rgba(139, 92, 246, 0.2),
                                             0 10px 25px rgba(0, 0, 0, 0.3),
                                             inset 0 1px 0 rgba(255, 255, 255, 0.1)
                                         `
                                    }}>
                                    <div className="min-h-[240px] max-h-[280px] overflow-y-auto flex items-start">
                                        <div className="w-full">
                                            {steps[currentStep].component}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Enhanced Navigation */}
                            <div className="flex justify-between mb-3">
                                {/* Back Button with 3D effect */}
                                <div className="relative">
                                    <div className={`absolute inset-0 rounded-lg blur-md ${currentStep === 0 ? 'bg-gray-700/30' : 'bg-gray-600/40'} transform scale-110`}></div>
                                    <button
                                        onClick={prevStep}
                                        disabled={currentStep === 0}
                                        className={`relative flex items-center space-x-2 px-4 py-2 rounded-lg font-black font-space-grotesk tracking-wide transition-all text-sm transform hover:scale-105 shadow-lg ${currentStep === 0
                                            ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600/50'
                                            : 'bg-gray-700/70 text-white hover:bg-gray-600/80 border border-gray-600/50 hover:border-gray-500/70 backdrop-blur-sm'
                                            }`}
                                        style={{
                                            boxShadow: currentStep === 0
                                                ? `0 5px 15px rgba(0, 0, 0, 0.2)`
                                                : `0 0 20px rgba(107, 114, 128, 0.3), 0 5px 15px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)`
                                        }}
                                    >
                                        <ChevronLeft className="w-4 h-4 drop-shadow-sm" />
                                        <span>Back</span>
                                    </button>
                                </div>

                                {/* Continue/Get Started Button with enhanced 3D effect */}
                                <div className="relative">
                                    {canProceed() && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-lg blur-xl opacity-50 transform scale-110 animate-pulse"></div>
                                    )}
                                    <button
                                        onClick={nextStep}
                                        disabled={!canProceed()}
                                        className={`relative flex items-center space-x-2 px-6 py-2 rounded-lg font-black font-space-grotesk tracking-wide transition-all text-sm transform hover:scale-105 hover:-translate-y-0.5 shadow-2xl ${canProceed()
                                            ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:from-purple-700 hover:to-cyan-700 border border-purple-500/50 hover:border-purple-400/70 shadow-purple-500/40 hover:shadow-purple-500/60 backdrop-blur-sm btn-depth-shadow'
                                            : 'bg-gray-700/50 text-gray-500 cursor-not-allowed border border-gray-600/50'
                                            }`}
                                    >
                                        <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}</span>
                                        <ChevronRight className="w-4 h-4 drop-shadow-sm" />
                                    </button>
                                </div>
                            </div>

                            {/* Enhanced Bottom Link */}
                            <div className="text-center">
                                <p className="text-gray-400 font-inter text-sm drop-shadow-md">
                                    Already have an account?{' '}
                                    <button
                                        onClick={() => setLocation('/login')}
                                        className="text-purple-400 hover:text-purple-300 font-black transition-colors underline underline-offset-2 tracking-wide"
                                    >
                                        Sign In
                                    </button>
                                </p>
                            </div>

                            {/* Floating decorative elements around the main content */}
                            <div className="absolute -top-4 -left-4 w-6 h-6 bg-purple-400 rounded-full opacity-60 animate-pulse blur-sm"></div>
                            <div className="absolute -top-2 -right-8 w-4 h-4 bg-cyan-400 rounded-full opacity-50 animate-pulse blur-sm animation-delay-1000"></div>
                            <div className="absolute -bottom-6 -left-8 w-5 h-5 bg-pink-400 rounded-full opacity-40 animate-pulse blur-sm animation-delay-2000"></div>
                            <div className="absolute -bottom-4 -right-4 w-3 h-3 bg-purple-300 rounded-full opacity-70 animate-pulse blur-sm animation-delay-3000"></div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
