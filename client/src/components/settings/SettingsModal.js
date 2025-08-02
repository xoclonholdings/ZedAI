"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SettingsModal;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var input_1 = require("@/components/ui/input");
var label_1 = require("@/components/ui/label");
var switch_1 = require("@/components/ui/switch");
var select_1 = require("@/components/ui/select");
var card_1 = require("@/components/ui/card");
var dialog_1 = require("@/components/ui/dialog");
var lucide_react_1 = require("lucide-react");
function SettingsModal(_a) {
    var open = _a.open, onOpenChange = _a.onOpenChange;
    var _b = (0, react_1.useState)('general'), activeSection = _b[0], setActiveSection = _b[1];
    var settings = {
        theme: 'dark',
        language: 'en',
        voiceType: 'ember',
        notifications: true,
        autoSave: true
    };
    return (<dialog_1.Dialog open={open} onOpenChange={onOpenChange}>
      <dialog_1.DialogContent className="bg-black/95 border-purple-500/30 max-w-4xl max-h-[90vh] overflow-y-auto">
        <dialog_1.DialogHeader>
          <dialog_1.DialogTitle className="text-white flex items-center gap-2">
            <lucide_react_1.Settings className="h-5 w-5"/>
            Settings
          </dialog_1.DialogTitle>
          <dialog_1.DialogDescription>
            Manage your ZED AI Assistant preferences and configuration
          </dialog_1.DialogDescription>
        </dialog_1.DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          {/* Navigation Sidebar */}
          <div className="md:col-span-1">
            <nav className="space-y-2">
              {[
            { id: 'general', label: 'General', icon: lucide_react_1.Settings },
            { id: 'personalization', label: 'Personalization', icon: lucide_react_1.User },
            { id: 'notifications', label: 'Notifications', icon: lucide_react_1.Bell },
            { id: 'privacy', label: 'Privacy', icon: lucide_react_1.Shield },
            { id: 'security', label: 'Security', icon: lucide_react_1.Lock },
            { id: 'archived', label: 'Archived', icon: lucide_react_1.Archive }
        ].map(function (item) {
            var Icon = item.icon;
            return (<button_1.Button key={item.id} variant="ghost" onClick={function () { return setActiveSection(item.id); }} className={"w-full justify-start p-3 ".concat(activeSection === item.id
                    ? 'bg-purple-500/20 text-purple-300 border-l-2 border-purple-500'
                    : 'text-muted-foreground hover:text-white hover:bg-black/40')}>
                    <Icon className="h-4 w-4 mr-3"/>
                    {item.label}
                  </button_1.Button>);
        })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="md:col-span-3">
            {activeSection === 'general' && (<card_1.Card className="bg-black/40 border-purple-500/20">
                <card_1.CardHeader>
                  <card_1.CardTitle className="flex items-center gap-2">
                    <lucide_react_1.Settings className="h-5 w-5"/>
                    General Settings
                  </card_1.CardTitle>
                  <card_1.CardDescription>
                    Configure your basic ZED preferences
                  </card_1.CardDescription>
                </card_1.CardHeader>
                <card_1.CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label_1.Label>Theme</label_1.Label>
                      <select_1.Select value={settings.theme}>
                        <select_1.SelectTrigger className="bg-black/40 border-purple-500/20">
                          <select_1.SelectValue />
                        </select_1.SelectTrigger>
                        <select_1.SelectContent className="bg-black/95 border-purple-500/30">
                          <select_1.SelectItem value="dark">Dark</select_1.SelectItem>
                          <select_1.SelectItem value="light">Light</select_1.SelectItem>
                          <select_1.SelectItem value="auto">Auto</select_1.SelectItem>
                        </select_1.SelectContent>
                      </select_1.Select>
                    </div>
                    <div className="space-y-2">
                      <label_1.Label>Language</label_1.Label>
                      <select_1.Select value={settings.language}>
                        <select_1.SelectTrigger className="bg-black/40 border-purple-500/20">
                          <select_1.SelectValue />
                        </select_1.SelectTrigger>
                        <select_1.SelectContent className="bg-black/95 border-purple-500/30">
                          <select_1.SelectItem value="en">English</select_1.SelectItem>
                          <select_1.SelectItem value="es">Spanish</select_1.SelectItem>
                          <select_1.SelectItem value="fr">French</select_1.SelectItem>
                        </select_1.SelectContent>
                      </select_1.Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label_1.Label>Auto-save conversations</label_1.Label>
                      <p className="text-sm text-muted-foreground">Automatically save your chat history</p>
                    </div>
                    <switch_1.Switch checked={settings.autoSave}/>
                  </div>
                </card_1.CardContent>
              </card_1.Card>)}

            {activeSection === 'personalization' && (<card_1.Card className="bg-black/40 border-purple-500/20">
                <card_1.CardHeader>
                  <card_1.CardTitle className="flex items-center gap-2">
                    <lucide_react_1.User className="h-5 w-5"/>
                    Personalization
                  </card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <p className="text-muted-foreground">Customize your ZED experience with personalized settings and preferences.</p>
                </card_1.CardContent>
              </card_1.Card>)}

            {activeSection === 'notifications' && (<card_1.Card className="bg-black/40 border-purple-500/20">
                <card_1.CardHeader>
                  <card_1.CardTitle className="flex items-center gap-2">
                    <lucide_react_1.Bell className="h-5 w-5"/>
                    Notifications
                  </card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <label_1.Label>Push notifications</label_1.Label>
                        <p className="text-sm text-muted-foreground">Receive notifications for new messages</p>
                      </div>
                      <switch_1.Switch checked={settings.notifications}/>
                    </div>
                  </div>
                </card_1.CardContent>
              </card_1.Card>)}

            {activeSection === 'privacy' && (<card_1.Card className="bg-black/40 border-purple-500/20">
                <card_1.CardHeader>
                  <card_1.CardTitle className="flex items-center gap-2">
                    <lucide_react_1.Shield className="h-5 w-5"/>
                    Privacy Settings
                  </card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <p className="text-muted-foreground">Manage your data privacy and control how your information is used.</p>
                </card_1.CardContent>
              </card_1.Card>)}

            {activeSection === 'security' && (<card_1.Card className="bg-black/40 border-purple-500/20">
                <card_1.CardHeader>
                  <card_1.CardTitle className="flex items-center gap-2">
                    <lucide_react_1.Lock className="h-5 w-5"/>
                    Security
                  </card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label_1.Label>Password</label_1.Label>
                      <input_1.Input type="password" placeholder="••••••••" className="bg-black/40 border-purple-500/20"/>
                    </div>
                  </div>
                </card_1.CardContent>
              </card_1.Card>)}

            {activeSection === 'archived' && (<card_1.Card className="bg-black/40 border-purple-500/20">
                <card_1.CardHeader>
                  <card_1.CardTitle className="flex items-center gap-2">
                    <lucide_react_1.Archive className="h-5 w-5"/>
                    Archived Chats
                  </card_1.CardTitle>
                </card_1.CardHeader>
                <card_1.CardContent>
                  <p className="text-muted-foreground">View and manage your archived conversations.</p>
                </card_1.CardContent>
              </card_1.Card>)}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-purple-500/20">
          <button_1.Button variant="outline" onClick={function () { return onOpenChange(false); }} className="bg-black/40 border-purple-500/20 hover:bg-black/60">
            Cancel
          </button_1.Button>
          <button_1.Button className="bg-purple-600 hover:bg-purple-700">
            Save Changes
          </button_1.Button>
        </div>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
