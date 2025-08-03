import TestChatArea from '@/components/chat/TestChatArea';

// Simple test page - ONLY main chat interface
export default function TestChatPage() {
    return (
        <div className="h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center p-4">
            {/* Container for chat interface */}
            <div className="w-full max-w-4xl h-full max-h-[600px] shadow-2xl">
                <TestChatArea />
            </div>
        </div>
    );
}
