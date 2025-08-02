import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Smile, 
  Image, 
  Languages, 
  Settings, 
  Palette,
  Volume2,
  Globe,
  Moon,
  Sun,
  Sparkles
} from "lucide-react";

interface InlineChatPanelProps {
  onEmojiSelect?: (emoji: string) => void;
  onGifSelect?: (gif: string) => void;
  onTranslate?: (text: string, targetLang: string) => void;
}

export default function InlineChatPanel({ onEmojiSelect, onGifSelect, onTranslate }: InlineChatPanelProps) {
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    theme: 'dark',
    language: 'en',
    voiceType: 'ember'
  });

  const emojis = ['😀', '😂', '🤔', '👍', '❤️', '🔥', '⚡', '🚀', '💡', '🎉', '👀', '💯', '🤖', '⭐', '💜'];
  const gifs = [
    'https://media.giphy.com/media/3o7TKTDn976rzVgky4/giphy.gif',
    'https://media.giphy.com/media/26u4cqZRnKeR6HSQU/giphy.gif',
    'https://media.giphy.com/media/l0MYu38R0PPhIXe36/giphy.gif'
  ];
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' }
  ];

  return (
    <div className="flex items-center space-x-1">
      {/* Emoji Picker */}
      <Popover open={activePanel === 'emoji'} onOpenChange={(open: boolean) => setActivePanel(open ? 'emoji' : null)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-purple-400 transition-colors"
          >
            <Smile size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 bg-black/95 border-purple-500/30" side="top">
          <div className="grid grid-cols-5 gap-2">
            {emojis.map((emoji, i) => (
              <Button
                key={i}
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-purple-500/20"
                onClick={() => {
                  onEmojiSelect?.(emoji);
                  setActivePanel(null);
                }}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* GIF Picker */}
      <Popover open={activePanel === 'gif'} onOpenChange={(open: boolean) => setActivePanel(open ? 'gif' : null)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-cyan-400 transition-colors"
          >
            <Image size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 bg-black/95 border-purple-500/30" side="top">
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif, i) => (
              <Button
                key={i}
                variant="ghost"
                className="h-20 w-full p-1 hover:bg-purple-500/20"
                onClick={() => {
                  onGifSelect?.(gif);
                  setActivePanel(null);
                }}
              >
                <img src={gif} alt={`GIF ${i}`} className="w-full h-full object-cover rounded" />
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Translate */}
      <Popover open={activePanel === 'translate'} onOpenChange={(open: boolean) => setActivePanel(open ? 'translate' : null)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-pink-400 transition-colors"
          >
            <Languages size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-3 bg-black/95 border-purple-500/30" side="top">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-2">Translate to:</div>
            {languages.map((lang) => (
              <Button
                key={lang.code}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs hover:bg-purple-500/20"
                onClick={() => {
                  onTranslate?.('', lang.code);
                  setActivePanel(null);
                }}
              >
                <Globe size={12} className="mr-2" />
                {lang.name}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Quick Settings */}
      <Popover open={activePanel === 'settings'} onOpenChange={(open: boolean) => setActivePanel(open ? 'settings' : null)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-yellow-400 transition-colors"
          >
            <Settings size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 bg-black/95 border-purple-500/30" side="top">
          <div className="space-y-3">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {settings.theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                <span className="text-xs">Theme</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-12 bg-black/40 hover:bg-black/60"
                onClick={() => setSettings({...settings, theme: settings.theme === 'dark' ? 'light' : 'dark'})}
              >
                <div className={`w-3 h-3 rounded-full transition-all ${settings.theme === 'dark' ? 'bg-purple-500 translate-x-2' : 'bg-gray-400 -translate-x-2'}`} />
              </Button>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Globe size={14} />
                <span className="text-xs">Language</span>
              </div>
              <Select value={settings.language} onValueChange={(value) => setSettings({...settings, language: value})}>
                <SelectTrigger className="h-6 w-16 text-xs bg-black/40 border-purple-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-purple-500/30">
                  <SelectItem value="en">EN</SelectItem>
                  <SelectItem value="es">ES</SelectItem>
                  <SelectItem value="fr">FR</SelectItem>
                  <SelectItem value="de">DE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Voice */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Volume2 size={14} />
                <span className="text-xs">Voice</span>
              </div>
              <Select value={settings.voiceType} onValueChange={(value) => setSettings({...settings, voiceType: value})}>
                <SelectTrigger className="h-6 w-16 text-xs bg-black/40 border-purple-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-purple-500/30">
                  <SelectItem value="ember">Ember</SelectItem>
                  <SelectItem value="nova">Nova</SelectItem>
                  <SelectItem value="breeze">Breeze</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* AI Mode Indicator */}
            <div className="flex items-center justify-center pt-2 border-t border-purple-500/20">
              <div className="flex items-center space-x-1 text-xs text-purple-400">
                <Sparkles size={12} />
                <span>Enhanced Mode</span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
