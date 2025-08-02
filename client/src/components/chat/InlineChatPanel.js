"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = InlineChatPanel;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var popover_1 = require("../ui/popover");
var select_1 = require("@/components/ui/select");
var lucide_react_1 = require("lucide-react");
function InlineChatPanel(_a) {
    var onEmojiSelect = _a.onEmojiSelect, onGifSelect = _a.onGifSelect, onTranslate = _a.onTranslate;
    var _b = (0, react_1.useState)(null), activePanel = _b[0], setActivePanel = _b[1];
    var _c = (0, react_1.useState)({
        theme: 'dark',
        language: 'en',
        voiceType: 'ember'
    }), settings = _c[0], setSettings = _c[1];
    var emojis = ['😀', '😂', '🤔', '👍', '❤️', '🔥', '⚡', '🚀', '💡', '🎉', '👀', '💯', '🤖', '⭐', '💜'];
    var gifs = [
        'https://media.giphy.com/media/3o7TKTDn976rzVgky4/giphy.gif',
        'https://media.giphy.com/media/26u4cqZRnKeR6HSQU/giphy.gif',
        'https://media.giphy.com/media/l0MYu38R0PPhIXe36/giphy.gif'
    ];
    var languages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'zh', name: 'Chinese' },
        { code: 'ja', name: 'Japanese' }
    ];
    return (<div className="flex items-center space-x-1">
      {/* Emoji Picker */}
      <popover_1.Popover open={activePanel === 'emoji'} onOpenChange={function (open) { return setActivePanel(open ? 'emoji' : null); }}>
        <popover_1.PopoverTrigger asChild>
          <button_1.Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-purple-400 transition-colors">
            <lucide_react_1.Smile size={16}/>
          </button_1.Button>
        </popover_1.PopoverTrigger>
        <popover_1.PopoverContent className="w-64 p-3 bg-black/95 border-purple-500/30" side="top">
          <div className="grid grid-cols-5 gap-2">
            {emojis.map(function (emoji, i) { return (<button_1.Button key={i} variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-purple-500/20" onClick={function () {
                onEmojiSelect === null || onEmojiSelect === void 0 ? void 0 : onEmojiSelect(emoji);
                setActivePanel(null);
            }}>
                {emoji}
              </button_1.Button>); })}
          </div>
        </popover_1.PopoverContent>
      </popover_1.Popover>

      {/* GIF Picker */}
      <popover_1.Popover open={activePanel === 'gif'} onOpenChange={function (open) { return setActivePanel(open ? 'gif' : null); }}>
        <popover_1.PopoverTrigger asChild>
          <button_1.Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-cyan-400 transition-colors">
            <lucide_react_1.Image size={16}/>
          </button_1.Button>
        </popover_1.PopoverTrigger>
        <popover_1.PopoverContent className="w-80 p-3 bg-black/95 border-purple-500/30" side="top">
          <div className="grid grid-cols-2 gap-2">
            {gifs.map(function (gif, i) { return (<button_1.Button key={i} variant="ghost" className="h-20 w-full p-1 hover:bg-purple-500/20" onClick={function () {
                onGifSelect === null || onGifSelect === void 0 ? void 0 : onGifSelect(gif);
                setActivePanel(null);
            }}>
                <img src={gif} alt={"GIF ".concat(i)} className="w-full h-full object-cover rounded"/>
              </button_1.Button>); })}
          </div>
        </popover_1.PopoverContent>
      </popover_1.Popover>

      {/* Translate */}
      <popover_1.Popover open={activePanel === 'translate'} onOpenChange={function (open) { return setActivePanel(open ? 'translate' : null); }}>
        <popover_1.PopoverTrigger asChild>
          <button_1.Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-pink-400 transition-colors">
            <lucide_react_1.Languages size={16}/>
          </button_1.Button>
        </popover_1.PopoverTrigger>
        <popover_1.PopoverContent className="w-48 p-3 bg-black/95 border-purple-500/30" side="top">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-2">Translate to:</div>
            {languages.map(function (lang) { return (<button_1.Button key={lang.code} variant="ghost" size="sm" className="w-full justify-start text-xs hover:bg-purple-500/20" onClick={function () {
                onTranslate === null || onTranslate === void 0 ? void 0 : onTranslate('', lang.code);
                setActivePanel(null);
            }}>
                <lucide_react_1.Globe size={12} className="mr-2"/>
                {lang.name}
              </button_1.Button>); })}
          </div>
        </popover_1.PopoverContent>
      </popover_1.Popover>

      {/* Quick Settings */}
      <popover_1.Popover open={activePanel === 'settings'} onOpenChange={function (open) { return setActivePanel(open ? 'settings' : null); }}>
        <popover_1.PopoverTrigger asChild>
          <button_1.Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-yellow-400 transition-colors">
            <lucide_react_1.Settings size={16}/>
          </button_1.Button>
        </popover_1.PopoverTrigger>
        <popover_1.PopoverContent className="w-64 p-3 bg-black/95 border-purple-500/30" side="top">
          <div className="space-y-3">
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {settings.theme === 'dark' ? <lucide_react_1.Moon size={14}/> : <lucide_react_1.Sun size={14}/>}
                <span className="text-xs">Theme</span>
              </div>
              <button_1.Button variant="ghost" size="sm" className="h-6 w-12 bg-black/40 hover:bg-black/60" onClick={function () { return setSettings(__assign(__assign({}, settings), { theme: settings.theme === 'dark' ? 'light' : 'dark' })); }}>
                <div className={"w-3 h-3 rounded-full transition-all ".concat(settings.theme === 'dark' ? 'bg-purple-500 translate-x-2' : 'bg-gray-400 -translate-x-2')}/>
              </button_1.Button>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <lucide_react_1.Globe size={14}/>
                <span className="text-xs">Language</span>
              </div>
              <select_1.Select value={settings.language} onValueChange={function (value) { return setSettings(__assign(__assign({}, settings), { language: value })); }}>
                <select_1.SelectTrigger className="h-6 w-16 text-xs bg-black/40 border-purple-500/20">
                  <select_1.SelectValue />
                </select_1.SelectTrigger>
                <select_1.SelectContent className="bg-black/95 border-purple-500/30">
                  <select_1.SelectItem value="en">EN</select_1.SelectItem>
                  <select_1.SelectItem value="es">ES</select_1.SelectItem>
                  <select_1.SelectItem value="fr">FR</select_1.SelectItem>
                  <select_1.SelectItem value="de">DE</select_1.SelectItem>
                </select_1.SelectContent>
              </select_1.Select>
            </div>

            {/* Voice */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <lucide_react_1.Volume2 size={14}/>
                <span className="text-xs">Voice</span>
              </div>
              <select_1.Select value={settings.voiceType} onValueChange={function (value) { return setSettings(__assign(__assign({}, settings), { voiceType: value })); }}>
                <select_1.SelectTrigger className="h-6 w-16 text-xs bg-black/40 border-purple-500/20">
                  <select_1.SelectValue />
                </select_1.SelectTrigger>
                <select_1.SelectContent className="bg-black/95 border-purple-500/30">
                  <select_1.SelectItem value="ember">Ember</select_1.SelectItem>
                  <select_1.SelectItem value="nova">Nova</select_1.SelectItem>
                  <select_1.SelectItem value="breeze">Breeze</select_1.SelectItem>
                </select_1.SelectContent>
              </select_1.Select>
            </div>

            {/* AI Mode Indicator */}
            <div className="flex items-center justify-center pt-2 border-t border-purple-500/20">
              <div className="flex items-center space-x-1 text-xs text-purple-400">
                <lucide_react_1.Sparkles size={12}/>
                <span>Enhanced Mode</span>
              </div>
            </div>
          </div>
        </popover_1.PopoverContent>
      </popover_1.Popover>
    </div>);
}
