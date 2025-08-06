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
                        <Shield size={20} className="mr-2 text-green-400" />
                        Privacy Settings
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
                        <span className="text-sm text-gray-300">Data Encryption</span>
                        <button
                            onClick={() => setEncryption(!encryption)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${encryption ? 'bg-green-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${encryption ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Anonymous Analytics</span>
                        <button
                            onClick={() => setAnonymousAnalytics(!anonymousAnalytics)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${anonymousAnalytics ? 'bg-green-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${anonymousAnalytics ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

{
    activePanel === 'data' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                        <Database size={20} className="mr-2 text-blue-400" />
                        Data Settings
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
                        <span className="text-sm text-gray-300">Cloud Sync</span>
                        <button
                            onClick={() => setCloudSync(!cloudSync)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${cloudSync ? 'bg-blue-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${cloudSync ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Context Memory</span>
                        <button
                            onClick={() => setContextMemory(!contextMemory)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${contextMemory ? 'bg-blue-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${contextMemory ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

{
    activePanel === 'satellite' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                        <Satellite size={20} className="mr-2 text-cyan-400" />
                        Satellite Settings
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
                        <span className="text-sm text-gray-300">Auto-Connect</span>
                        <button
                            onClick={() => setSatelliteAutoConnect(!satelliteAutoConnect)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${satelliteAutoConnect ? 'bg-cyan-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${satelliteAutoConnect ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Low Latency Mode</span>
                        <button
                            onClick={() => setSatelliteLowLatency(!satelliteLowLatency)}
                            className={`w-10 h-5 rounded-full relative transition-colors ${satelliteLowLatency ? 'bg-cyan-600' : 'bg-gray-600'}`}
                        >
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${satelliteLowLatency ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                        </button>
                    </div>

                    <div className="space-y-2">
                        <span className="text-sm text-gray-300">Signal Strength: {satelliteSignalStrength}%</span>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-cyan-400 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${satelliteSignalStrength}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <span className="text-sm text-gray-300">Latency: {satelliteLatency}ms</span>
                        <span className="text-sm text-gray-300">Bandwidth: {satelliteBandwidth} Mbps</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

{
    activePanel === 'advanced' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
            <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center">
                        <Settings size={20} className="mr-2 text-purple-400" />
                        Advanced Settings
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
                    <div className="space-y-2">
                        <span className="text-sm text-gray-300">Theme</span>
                        <select
                            value={theme}
                            onChange={(e) => setTheme(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                        >
                            <option value="cyberpunk">Cyberpunk</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <span className="text-sm text-gray-300">Language</span>
                        <select
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                        >
                            <option value="en">English</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <span className="text-sm text-gray-300">Response Style</span>
                        <select
                            value={responseStyle}
                            onChange={(e) => setResponseStyle(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                        >
                            <option value="balanced">Balanced</option>
                            <option value="creative">Creative</option>
                            <option value="precise">Precise</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )
}
    </div >
  );
}
