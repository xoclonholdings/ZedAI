import OldChatArea from '@/components/chat/OldChatArea';

// Test page for OLD chat interface - Original design
export default function TestChat2Page() {
    return (
        <div className="h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 flex items-center justify-center p-4">
            {/* Container for OLD chat interface */}
            <div className="w-full max-w-4xl h-full max-h-[600px] shadow-2xl">
                <OldChatArea />
            </div>
        </div>
    );
}
