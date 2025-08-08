{/* Overlays for different panels */ }
{
    activePanel === 'alerts' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                        <Bell size={20} className="mr-2 text-yellow-400" />
                        Alert Settings
                    </h3>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActivePanel(null)}
                        className="text-gray-400 hover:text-white"
                    >
                        <X size={16} />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">New Messages</span>
                        <button
                            onClick={() => setNewMessages(!newMessages)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${newMessages ? 'bg-purple-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${newMessages ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">System Updates</span>
                        <button
                            onClick={() => setSystemUpdates(!systemUpdates)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${systemUpdates ? 'bg-purple-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${systemUpdates ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Marketing</span>
                        <button
                            onClick={() => setMarketing(!marketing)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${marketing ? 'bg-purple-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${marketing ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

{
    activePanel === 'privacy' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                        // This file is intentionally renamed to prevent build errors. Original file was broken.
                        Privacy Settings
