import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Sparkles, 
  Zap, 
  Shield, 
  Users, 
  MessageSquare,
  FileText,
  Rss
} from "lucide-react";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-purple-600/20 to-cyan-500/20 rounded-full blur-3xl zed-float" />
        <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-r from-pink-500/20 to-purple-600/20 rounded-full blur-2xl zed-float-delay" />
        <div className="absolute bottom-32 left-1/3 w-40 h-40 bg-gradient-to-r from-cyan-500/15 to-blue-600/15 rounded-full blur-3xl zed-float" />
        <div className="absolute bottom-20 right-10 w-28 h-28 bg-gradient-to-r from-purple-600/20 to-pink-500/20 rounded-full blur-2xl zed-float-delay" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="p-8">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 zed-avatar rounded-2xl flex items-center justify-center">
                <Zap size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  ZED
                </h1>
                <p className="text-xs text-muted-foreground">Enhanced AI Assistant</p>
              </div>
            </div>

            <Button 
              onClick={() => window.location.href = '/api/login'}
              className="zed-button rounded-xl px-6 py-2"
            >
              <Shield size={16} className="mr-2" />
              Sign In
            </Button>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex items-center justify-center px-8">
          <div className="max-w-6xl mx-auto text-center">
            <div className="mb-8">
              <div className="inline-flex items-center space-x-2 bg-white/5 rounded-full px-4 py-2 mb-6 zed-glass">
                <Sparkles size={16} className="text-purple-400" />
                <span className="text-sm text-muted-foreground">Powered by Advanced AI</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-bold mb-6">
                <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
                  ZED
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
                Enhanced AI assistant combining powerful conversations with document processing 
                and social media integration in a cyberpunk-themed interface
              </p>

              <Button 
                onClick={() => window.location.href = '/api/login'}
                size="lg"
                className="zed-button rounded-xl px-8 py-4 text-lg"
              >
                <img src={zLogoPath} alt="Z" className="w-5 h-5 mr-2" />
                Get Started
              </Button>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16">
              <Card className="zed-message p-6 hover:zed-glow transition-all duration-300">
                <div className="w-12 h-12 zed-avatar rounded-2xl flex items-center justify-center mb-4">
                  <MessageSquare size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">AI Conversations</h3>
                <p className="text-sm text-muted-foreground">
                  Intelligent chat powered by advanced language models with streaming responses
                </p>
              </Card>

              <Card className="zed-message p-6 hover:zed-glow transition-all duration-300">
                <div className="w-12 h-12 zed-avatar rounded-2xl flex items-center justify-center mb-4">
                  <FileText size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Document Processing</h3>
                <p className="text-sm text-muted-foreground">
                  Upload and analyze documents, images, and files up to 32GB
                </p>
              </Card>

              <Card className="zed-message p-6 hover:zed-glow transition-all duration-300">
                <div className="w-12 h-12 zed-avatar rounded-2xl flex items-center justify-center mb-4">
                  <Rss size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Social Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Connect Instagram, X, Snapchat, and Flip.shop feeds
                </p>
              </Card>

              <Card className="zed-message p-6 hover:zed-glow transition-all duration-300">
                <div className="w-12 h-12 zed-avatar rounded-2xl flex items-center justify-center mb-4">
                  <Shield size={20} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">Secure Access</h3>
                <p className="text-sm text-muted-foreground">
                  Protected by Replit authentication to keep your data safe
                </p>
              </Card>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Built with modern web technologies • Cyberpunk meets AI
          </p>
        </footer>
      </div>
    </div>
  );
}