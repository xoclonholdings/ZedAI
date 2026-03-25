import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Zap, 
  Sparkles,
  Info,
  Bot
} from "lucide-react";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";
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
    <div className="space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center space-x-2">
          <Bot className="text-cyan-400" size={20} />
          <h3 className="text-lg md:text-xl font-semibold text-foreground">Choose Your ZED Experience</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Select how you want ZED to interact with you
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-2xl mx-auto">
        {modes.map((mode) => {
          const isSelected = selectedMode === mode.id;
          
          return (
            <Card
              key={mode.id}
              className={`p-4 md:p-6 cursor-pointer transition-all duration-300 hover:zed-glow ${
                isSelected 
                  ? 'ring-2 ring-cyan-400/50 zed-gradient border-transparent' 
                  : 'zed-message hover:border-cyan-400/30'
              }`}
              onClick={() => !disabled && onModeChange(mode.id)}
            >
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-r ${mode.color} flex items-center justify-center ${
                      isSelected ? 'zed-pulse' : ''
                    }`}>
                      {mode.id === "chat" ? (
                        <MessageSquare className="text-white" size={20} />
                      ) : (
                        <img src={zLogoPath} alt="Z" className="w-5 h-5 filter brightness-0 invert" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{mode.name}</h4>
                      <Badge 
                        variant="outline" 
                        className={`text-xs mt-1 ${
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
                    <div className="w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center">
                      <Sparkles size={12} className="text-black" />
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {mode.description}
                </p>

                {/* Features */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                    <Info size={12} />
                    <span>Key Features:</span>
                  </div>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {mode.features.map((feature, index) => (
                      <li key={index} className="flex items-center space-x-2">
                        <Zap size={8} className="text-cyan-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Mode Description */}
      <Card className="zed-message p-4">
        <div className="flex items-start space-x-3">
          <Info className="text-cyan-400 mt-0.5" size={16} />
          <div className="text-xs text-muted-foreground">
            <p className="mb-2">
              <strong className="text-cyan-300">Chat Mode:</strong> Perfect for learning, asking questions, and having conversations where you want to stay in control of the flow.
            </p>
            <p>
              <strong className="text-purple-300">Agent Mode:</strong> Ideal for complex tasks where you want ZED to work autonomously and provide comprehensive solutions with minimal interruption.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}