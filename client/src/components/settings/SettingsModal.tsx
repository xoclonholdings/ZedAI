import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  Archive, 
  Lock, 
  Cloud, 
  Globe, 
  Moon, 
  Sun, 
  Volume2, 
  Palette,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<string>('general');

  const settings = {
    theme: 'dark',
    language: 'en',
    voiceType: 'ember',
    notifications: true,
    autoSave: true
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black/95 border-purple-500/30 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Manage your ZED AI Assistant preferences and configuration
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
          {/* Navigation Sidebar */}
          <div className="md:col-span-1">
            <nav className="space-y-2">
              {[
                { id: 'general', label: 'General', icon: Settings },
                { id: 'personalization', label: 'Personalization', icon: User },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'privacy', label: 'Privacy', icon: Shield },
                { id: 'security', label: 'Security', icon: Lock },
                { id: 'archived', label: 'Archived', icon: Archive }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Button
                    key={item.id}
                    variant="ghost"
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full justify-start p-3 ${
                      activeSection === item.id 
                        ? 'bg-purple-500/20 text-purple-300 border-l-2 border-purple-500' 
                        : 'text-muted-foreground hover:text-white hover:bg-black/40'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-3" />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="md:col-span-3">
            {activeSection === 'general' && (
              <Card className="bg-black/40 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    General Settings
                  </CardTitle>
                  <CardDescription>
                    Configure your basic ZED preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Theme</Label>
                      <Select value={settings.theme}>
                        <SelectTrigger className="bg-black/40 border-purple-500/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black/95 border-purple-500/30">
                          <SelectItem value="dark">Dark</SelectItem>
                          <SelectItem value="light">Light</SelectItem>
                          <SelectItem value="auto">Auto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select value={settings.language}>
                        <SelectTrigger className="bg-black/40 border-purple-500/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-black/95 border-purple-500/30">
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-save conversations</Label>
                      <p className="text-sm text-muted-foreground">Automatically save your chat history</p>
                    </div>
                    <Switch checked={settings.autoSave} />
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'personalization' && (
              <Card className="bg-black/40 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Personalization
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Customize your ZED experience with personalized settings and preferences.</p>
                </CardContent>
              </Card>
            )}

            {activeSection === 'notifications' && (
              <Card className="bg-black/40 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Push notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive notifications for new messages</p>
                      </div>
                      <Switch checked={settings.notifications} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'privacy' && (
              <Card className="bg-black/40 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Privacy Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Manage your data privacy and control how your information is used.</p>
                </CardContent>
              </Card>
            )}

            {activeSection === 'security' && (
              <Card className="bg-black/40 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <Input type="password" placeholder="••••••••" className="bg-black/40 border-purple-500/20" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'archived' && (
              <Card className="bg-black/40 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Archive className="h-5 w-5" />
                    Archived Chats
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">View and manage your archived conversations.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-purple-500/20">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="bg-black/40 border-purple-500/20 hover:bg-black/60">
            Cancel
          </Button>
          <Button className="bg-purple-600 hover:bg-purple-700">
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}