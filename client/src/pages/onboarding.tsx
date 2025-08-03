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
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-cyan-600 rounded-full flex items-center justify-center mb-4">
                <Sparkles size={32} className="text-white" />
            </div>
            <h3 className="text-xl font-black text-white font-space-grotesk tracking-wide">
                Welcome to ZED AI
            </h3>
            <p className="text-sm text-gray-200 leading-relaxed font-inter font-bold">
                Your journey into the future of artificial intelligence begins here. 
                Let's set up your account and customize your AI experience.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="bg-purple-600/20 rounded-lg p-3 border border-purple-500/30">
                    <MessageSquare className="w-6 h-6 text-purple-400 mb-2" />
                    <p className="text-xs font-black text-white">AI Chat</p>
                </div>
                <div className="bg-cyan-600/20 rounded-lg p-3 border border-cyan-500/30">
                    <FileText className="w-6 h-6 text-cyan-400 mb-2" />
                    <p className="text-xs font-black text-white">Documents</p>
                </div>
            </div>
        </div>
    )

    // Step 2: Account Creation
    const AccountStep = () => (
        <div className="space-y-4">
            <div className="text-center mb-4">
                <User className="w-12 h-12 mx-auto text-purple-400 mb-2" />
                <h3 className="text-xl font-black text-white font-space-grotesk tracking-wide">
                    Create Your Account
                </h3>
                <p className="text-sm text-gray-200 font-inter font-bold">
                    Choose your username and secure your account
                </p>
            </div>
            
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-black text-gray-200 mb-1 font-space-grotesk tracking-wide">
                        Username
                    </label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => updateFormData('username', e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-inter text-sm"
                            placeholder="Enter your username"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black text-gray-200 mb-1 font-space-grotesk tracking-wide">
                        Email Address
                    </label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => updateFormData('email', e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-inter text-sm"
                            placeholder="Enter your email"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black text-gray-200 mb-1 font-space-grotesk tracking-wide">
                        Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => updateFormData('password', e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-inter text-sm"
                            placeholder="Create a secure password"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-black text-gray-200 mb-1 font-space-grotesk tracking-wide">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                            className="w-full pl-10 pr-3 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-inter text-sm"
                            placeholder="Confirm your password"
                        />
                    </div>
                </div>
            </div>
        </div>
    )

    // Step 3: Preferences
    const PreferencesStep = () => (
        <div className="space-y-4">
            <div className="text-center mb-4">
                <Sparkles className="w-12 h-12 mx-auto text-cyan-400 mb-2" />
                <h3 className="text-xl font-black text-white font-space-grotesk tracking-wide">
                    Customize Your Experience
                </h3>
                <p className="text-sm text-gray-200 font-inter font-bold">
                    Choose which features you'd like to enable
                </p>
            </div>

            <div className="space-y-3">
                {[
                    { key: 'aiConversations', icon: MessageSquare, title: 'AI Conversations', desc: 'Enable intelligent chat' },
                    { key: 'documentProcessing', icon: FileText, title: 'Document Processing', desc: 'Upload and analyze files' },
                    { key: 'socialIntegration', icon: Rss, title: 'Social Integration', desc: 'Connect social feeds' },
                    { key: 'notifications', icon: Shield, title: 'Notifications', desc: 'Receive AI updates' }
                ].map(({ key, icon: Icon, title, desc }) => (
                    <div 
                        key={key}
                        className="bg-gray-900/50 border border-purple-500/30 rounded-lg p-3 hover:border-purple-500/50 transition-all cursor-pointer"
                        onClick={() => updatePreferences(key, !formData.preferences[key as keyof typeof formData.preferences])}
                    >
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center">
                                <Icon className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-black text-white font-space-grotesk tracking-wide text-sm">{title}</h4>
                                <p className="text-xs text-gray-300 font-inter">{desc}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                formData.preferences[key as keyof typeof formData.preferences] 
                                    ? 'border-purple-500 bg-purple-500' 
                                    : 'border-gray-500'
                            }`}>
                                {formData.preferences[key as keyof typeof formData.preferences] && (
                                    <Check className="w-3 h-3 text-white" />
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )

    // Step 4: Complete
    const CompleteStep = () => (
        <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-green-600 to-cyan-600 rounded-full flex items-center justify-center mb-4">
                <Check size={32} className="text-white" />
            </div>
            <h3 className="text-xl font-black text-white font-space-grotesk tracking-wide">
                Welcome Aboard, {formData.username || 'User'}!
            </h3>
            <p className="text-sm text-gray-200 leading-relaxed font-inter font-bold">
                Your ZED AI account has been successfully created. 
                You're now ready to experience the future of artificial intelligence.
            </p>
            <div className="bg-gradient-to-r from-purple-600/20 to-cyan-600/20 rounded-lg p-4 border border-purple-500/30">
                <h4 className="font-black text-white mb-3 font-space-grotesk text-sm">What's Next?</h4>
                <div className="grid grid-cols-1 gap-2 text-left">
                    <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>
                        <span className="text-gray-200 font-inter text-xs">Start your first AI conversation</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></div>
                        <span className="text-gray-200 font-inter text-xs">Upload documents for analysis</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-pink-400 rounded-full"></div>
                        <span className="text-gray-200 font-inter text-xs">Explore advanced AI features</span>
                    </div>
                </div>
            </div>
        </div>
    )

    const steps: OnboardingStep[] = [
        { id: 0, title: 'Welcome', description: 'Introduction to ZED AI', component: <WelcomeStep /> },
        { id: 1, title: 'Account', description: 'Create your account', component: <AccountStep /> },
        { id: 2, title: 'Preferences', description: 'Customize features', component: <PreferencesStep /> },
        { id: 3, title: 'Complete', description: 'All set!', component: <CompleteStep /> }
    ]

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            // Complete onboarding, redirect to chat
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

    return (
        <div className="h-screen bg-black flex flex-col relative overflow-hidden">
            {/* Animated Background Orbs */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-pink-600 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000"></div>
            </div>

            <div className="relative z-10 flex flex-col h-full">
                {/* Header with Logo */}
                <header className="p-3">
                    <div className="flex items-center justify-center">
                        <h1 className="text-2xl font-black bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-space-grotesk tracking-widest drop-shadow-lg">
                            ZED
                        </h1>
                        <div className="ml-0 -mt-1">
                            <ZedLogo className="w-4 h-4" />
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex-1 flex items-center justify-center px-4">
                    <div className="w-full max-w-lg">
                        {/* Progress Indicator */}
                        <div className="mb-6">
                            <div className="flex justify-between mb-3">
                                {steps.map((step, index) => (
                                    <div key={step.id} className="flex flex-col items-center">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                                            index <= currentStep 
                                                ? 'border-purple-500 bg-purple-500 text-white' 
                                                : 'border-gray-600 text-gray-400'
                                        }`}>
                                            {index < currentStep ? (
                                                <Check className="w-4 h-4" />
                                            ) : (
                                                <span className="text-xs font-black">{index + 1}</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-400 mt-1 font-space-grotesk font-black">
                                            {step.title}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-1.5">
                                <div 
                                    className="bg-gradient-to-r from-purple-500 to-cyan-500 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Step Content */}
                        <div className="bg-gray-900/30 backdrop-blur-sm border border-purple-500/30 rounded-xl p-6 mb-6">
                            <div className="h-80 flex items-center">
                                {steps[currentStep].component}
                            </div>
                        </div>

                        {/* Navigation */}
                        <div className="flex justify-between">
                            <button
                                onClick={prevStep}
                                disabled={currentStep === 0}
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-black font-space-grotesk tracking-wide transition-all text-sm ${
                                    currentStep === 0
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-gray-700 text-white hover:bg-gray-600 border border-gray-600 hover:border-gray-500'
                                }`}
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span>Back</span>
                            </button>

                            <button
                                onClick={nextStep}
                                disabled={!canProceed()}
                                className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-black font-space-grotesk tracking-wide transition-all text-sm ${
                                    canProceed()
                                        ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white hover:from-purple-700 hover:to-cyan-700 border border-purple-500 hover:border-purple-400 shadow-lg hover:shadow-purple-500/25'
                                        : 'bg-gray-700 text-gray-500 cursor-not-allowed border border-gray-600'
                                }`}
                            >
                                <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Continue'}</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Bottom Link */}
                        <div className="text-center mt-4">
                            <p className="text-gray-400 font-inter text-sm">
                                Already have an account?{' '}
                                <button 
                                    onClick={() => setLocation('/')}
                                    className="text-purple-400 hover:text-purple-300 font-black transition-colors"
                                >
                                    Sign In
                                </button>
                            </p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
