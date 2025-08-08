// import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Sparkles, Bot } from "lucide-react";
const zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";
import type { ConversationMode } from "@shared/schema";

interface ModeSelectorProps {
  selectedMode: ConversationMode;
  onModeChange: (mode: ConversationMode) => void;
  disabled?: boolean;
}

export default function ModeSelector({ selectedMode, onModeChange, disabled }: ModeSelectorProps) {
  const modes = [
    {
      id: "chat" as ConversationMode,
      name: "Chat Mode",
      icon: MessageSquare,
      description: "Traditional conversational AI experience",
      features: [
        "Back-and-forth conversation",
        "Step-by-step guidance", 
        "User-controlled interactions",
        "Clear question-answer format"
      ],
      color: "from-blue-500 to-cyan-500",
      badge: "Classic"
    },
    {
      id: "agent" as ConversationMode,
      name: "Agent Mode", 
      icon: "Z",
      description: "Autonomous AI agent that works independently",
      features: [
        "Autonomous task execution",
        "Extended work sessions",
        "Proactive problem solving",
        "Comprehensive solutions"
      ],
      color: "from-purple-500 to-pink-500",
      badge: "Advanced"
    }
  ];

  return (
    <div className="space-y-2 max-h-[40vh] overflow-y-auto">
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center space-x-2">
          <Bot className="text-cyan-400" size={16} />
          <h3 className="text-base font-semibold text-foreground">Choose Your ZED Experience</h3>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 max-w-xl mx-auto">
        {modes.map((mode) => {
          const isSelected = selectedMode === mode.id;
          
          return (
            <Card
              key={mode.id}
              className={`p-3 cursor-pointer transition-all duration-300 hover:zed-glow ${
                isSelected 
                  ? 'ring-2 ring-cyan-400/50 zed-gradient border-transparent' 
                  : 'zed-message hover:border-cyan-400/30'
              }`}
              onClick={() => !disabled && onModeChange(mode.id)}
            >
              <div className="space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-r ${mode.color} flex items-center justify-center ${
                      isSelected ? 'zed-pulse' : ''
                    }`}>
                      {mode.id === "chat" ? (
                        <MessageSquare className="text-white" size={14} />
                      ) : (
                        <img src={zLogoPath} alt="Z" className="w-3 h-3 filter brightness-0 invert" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{mode.name}</h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${
                          isSelected 
                            ? 'border-cyan-400/50 text-cyan-300' 
                            : 'border-purple-400/30 text-purple-300'
                        }`}
                      >
                        {mode.badge}
                      </Badge>
                    </div>
                  </div>
                  
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center">
                      <Sparkles size={8} className="text-black" />
                    </div>
                  )}
                </div>

                {/* Compact Description */}
                <p className="text-xs text-muted-foreground leading-tight">
                  {mode.description}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}