import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { 
  Settings, 
  User, 
  Lock, 
  Save, 
  Eye, 
  EyeOff, 
  Users,
  Bell,
  Shield,
  Archive,
  Palette,
  Globe,
  Mic,
  Volume2,
  Smartphone,
  Type,
  TrendingUp,
  MessageSquare,
  ChevronRight
} from "lucide-react";
import zLogoPath from "@assets/IMG_2227_1753477194826.png";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import UserManagement from "@/components/UserManagement";

// Admin Security Settings Component
function AdminSecuritySettings() {
  const [securitySettings, setSecuritySettings] = useState({
    currentSecurePhrase: "",
    sessionTimeoutMinutes: 45,
    maxFailedAttempts: 3,
    lockoutDurationMinutes: 15
  });
  const [newSecurePhrase, setNewSecurePhrase] = useState("");
  const [showCurrentPhrase, setShowCurrentPhrase] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSecuritySettings = async () => {
    try {
      const response = await fetch('/api/admin/security-settings');
      if (response.ok) {
        const data = await response.json();
        setSecuritySettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch security settings:', error);
    }
  };

  const updateSecuritySettings = async () => {
    if (!newSecurePhrase.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/security-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSecurePhrase: newSecurePhrase.trim() })
      });

      if (response.ok) {
        await fetchSecuritySettings();
        setNewSecurePhrase("");
        alert('Secure phrase updated successfully!');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update secure phrase');
      }
    } catch (error) {
      alert('Failed to update secure phrase');
    } finally {
      setIsLoading(false);
    }
  };

  // Load settings on mount
  useEffect(() => {
    fetchSecuritySettings();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="zed-glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Security Settings
          </CardTitle>
          <CardDescription>
            Manage advanced security settings for the ZED system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Security Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Current Security Status</h4>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• Session timeout: {securitySettings.sessionTimeoutMinutes} minutes</p>
              <p>• Max failed attempts: {securitySettings.maxFailedAttempts}</p>
              <p>• Lockout duration: {securitySettings.lockoutDurationMinutes} minutes</p>
            </div>
          </div>

          {/* Current Secure Phrase */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Current Secure Phrase</Label>
            <div className="flex items-center space-x-2">
              <Input
                type={showCurrentPhrase ? "text" : "password"}
                value={securitySettings.currentSecurePhrase}
                readOnly
                className="zed-glass border-white/10 bg-black/20"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowCurrentPhrase(!showCurrentPhrase)}
                className="zed-glass border-white/10"
              >
                {showCurrentPhrase ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Update Secure Phrase */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Update Secure Phrase</Label>
            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Enter new secure phrase (min 8 characters)"
                value={newSecurePhrase}
                onChange={(e) => setNewSecurePhrase(e.target.value)}
                className="zed-glass border-white/10"
              />
              <Button
                onClick={updateSecuritySettings}
                disabled={isLoading || newSecurePhrase.length < 8}
                className="w-full zed-glass bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update Secure Phrase
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The secure phrase is used for admin verification and bypass authentication. 
              It must be at least 8 characters long and should be kept confidential.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface CredentialsForm {
  newUsername: string;
  newPassword: string;
  confirmPassword: string;
}

interface AppSettings {
  notifications: boolean;
  hapticFeedback: boolean;
  autoSpellCorrect: boolean;
  autoSendDictation: boolean;
  backgroundConversations: boolean;
  autocomplete: boolean;
  trendingSearches: boolean;
  followUpSuggestions: boolean;
  colorScheme: 'dark' | 'light' | 'auto';
  language: string;
  voiceType: string;
}

export default function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('main');
  const [form, setForm] = useState<CredentialsForm>({
    newUsername: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [appSettings, setAppSettings] = useState<AppSettings>({
    notifications: true,
    hapticFeedback: true,
    autoSpellCorrect: true,
    autoSendDictation: false,
    backgroundConversations: true,
    autocomplete: false,
    trendingSearches: true,
    followUpSuggestions: false,
    colorScheme: 'dark',
    language: 'English',
    voiceType: 'Ember'
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth() as { user?: any };

  // Get current credentials
  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/current-credentials"],
    enabled: isOpen,
  });

  // Update credentials mutation
  const updateCredentialsMutation = useMutation({
    mutationFn: async (data: { newUsername: string; newPassword: string }) => {
      return await apiRequest("/api/auth/update-credentials", "POST", data);
    },
    onSuccess: (data) => {
      toast({
        title: "Credentials Updated",
        description: "Your login credentials have been changed successfully.",
      });
      setForm({ newUsername: "", newPassword: "", confirmPassword: "" });
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/current-credentials"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update credentials",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.newUsername || !form.newPassword) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (form.newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    updateCredentialsMutation.mutate({
      newUsername: form.newUsername,
      newPassword: form.newPassword,
    });
  };

  const handleFormChange = (field: keyof CredentialsForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start zed-button"
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="zed-glass border-white/10 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <img src={zLogoPath} alt="Z" className="h-4 w-4" />
            <span><span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span> Settings</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Manage your account and login credentials
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {activeSection === 'main' && (
            <div className="space-y-4">
              {/* Main Settings Options */}
              <div className="space-y-2">
                <Button
                  variant="ghost"
                  onClick={() => setActiveSection('personalization')}
                  className="w-full justify-between h-auto p-4 zed-glass border-white/10 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-purple-400" />
                    <span className="text-foreground">Personalization</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setActiveSection('notifications')}
                  className="w-full justify-between h-auto p-4 zed-glass border-white/10 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <Bell className="h-5 w-5 text-cyan-400" />
                    <span className="text-foreground">Notifications</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setActiveSection('data')}
                  className="w-full justify-between h-auto p-4 zed-glass border-white/10 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <Shield className="h-5 w-5 text-pink-400" />
                    <span className="text-foreground">Data Controls</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setActiveSection('archived')}
                  className="w-full justify-between h-auto p-4 zed-glass border-white/10 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <Archive className="h-5 w-5 text-yellow-400" />
                    <span className="text-foreground">Archived Chats</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => setActiveSection('security')}
                  className="w-full justify-between h-auto p-4 zed-glass border-white/10 text-left"
                >
                  <div className="flex items-center space-x-3">
                    <Lock className="h-5 w-5 text-red-400" />
                    <span className="text-foreground">Security</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              {/* App Section */}
              <div className="pt-6 border-t border-white/10">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-4">APP</h3>
                <div className="space-y-4">
                  {/* App Language */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Globe className="h-5 w-5 text-blue-400" />
                      <span className="text-foreground">App Language</span>
                    </div>
                    <Select value={appSettings.language} onValueChange={(value) => setAppSettings({...appSettings, language: value})}>
                      <SelectTrigger className="w-24 h-8 zed-glass border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="zed-glass border-white/10">
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Spanish">Spanish</SelectItem>
                        <SelectItem value="French">French</SelectItem>
                        <SelectItem value="German">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Auto Send with Dictation */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Mic className="h-5 w-5 text-green-400" />
                      <span className="text-foreground">Auto Send with Dictation</span>
                    </div>
                    <Switch
                      checked={appSettings.autoSendDictation}
                      onCheckedChange={(checked) => setAppSettings({...appSettings, autoSendDictation: checked})}
                    />
                  </div>

                  {/* Color Scheme */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Palette className="h-5 w-5 text-purple-400" />
                      <span className="text-foreground">Color Scheme</span>
                    </div>
                    <Select value={appSettings.colorScheme} onValueChange={(value: 'dark' | 'light' | 'auto') => setAppSettings({...appSettings, colorScheme: value})}>
                      <SelectTrigger className="w-20 h-8 zed-glass border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="zed-glass border-white/10">
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Haptic Feedback */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="h-5 w-5 text-cyan-400" />
                      <span className="text-foreground">Haptic Feedback</span>
                    </div>
                    <Switch
                      checked={appSettings.hapticFeedback}
                      onCheckedChange={(checked) => setAppSettings({...appSettings, hapticFeedback: checked})}
                    />
                  </div>

                  {/* Correct Spelling Automatically */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Type className="h-5 w-5 text-orange-400" />
                      <span className="text-foreground">Correct Spelling Automatically</span>
                    </div>
                    <Switch
                      checked={appSettings.autoSpellCorrect}
                      onCheckedChange={(checked) => setAppSettings({...appSettings, autoSpellCorrect: checked})}
                    />
                  </div>
                </div>
              </div>

              {/* Voice Mode Section */}
              <div className="pt-6 border-t border-white/10">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-4">VOICE MODE</h3>
                <div className="space-y-4">
                  {/* Voice Type */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Volume2 className="h-5 w-5 text-pink-400" />
                      <span className="text-foreground">Voice</span>
                    </div>
                    <Select value={appSettings.voiceType} onValueChange={(value) => setAppSettings({...appSettings, voiceType: value})}>
                      <SelectTrigger className="w-24 h-8 zed-glass border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="zed-glass border-white/10">
                        <SelectItem value="Ember">Ember</SelectItem>
                        <SelectItem value="Nova">Nova</SelectItem>
                        <SelectItem value="Breeze">Breeze</SelectItem>
                        <SelectItem value="Juniper">Juniper</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Background Conversations */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <MessageSquare className="h-5 w-5 text-blue-400" />
                        <span className="text-foreground">Background Conversations</span>
                      </div>
                      <Switch
                        checked={appSettings.backgroundConversations}
                        onCheckedChange={(checked) => setAppSettings({...appSettings, backgroundConversations: checked})}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground ml-8">
                      Background conversations keep the conversation going in other apps or while your screen is off.
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggestions Section */}
              <div className="pt-6 border-t border-white/10">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-4">SUGGESTIONS</h3>
                <div className="space-y-4">
                  {/* Autocomplete */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Type className="h-5 w-5 text-green-400" />
                      <span className="text-foreground">Autocomplete</span>
                    </div>
                    <Switch
                      checked={appSettings.autocomplete}
                      onCheckedChange={(checked) => setAppSettings({...appSettings, autocomplete: checked})}
                    />
                  </div>

                  {/* Trending Searches */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="h-5 w-5 text-yellow-400" />
                      <span className="text-foreground">Trending Searches</span>
                    </div>
                    <Switch
                      checked={appSettings.trendingSearches}
                      onCheckedChange={(checked) => setAppSettings({...appSettings, trendingSearches: checked})}
                    />
                  </div>

                  {/* Follow-up Suggestions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="h-5 w-5 text-purple-400" />
                      <span className="text-foreground">Follow-up Suggestions</span>
                    </div>
                    <Switch
                      checked={appSettings.followUpSuggestions}
                      onCheckedChange={(checked) => setAppSettings({...appSettings, followUpSuggestions: checked})}
                    />
                  </div>
                </div>
              </div>

              {/* Admin Section */}
              {user?.username === 'Admin' && (
                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-4">ADMIN</h3>
                  <Button
                    variant="ghost"
                    onClick={() => setActiveSection('admin')}
                    className="w-full justify-between h-auto p-4 zed-glass border-white/10 text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <Users className="h-5 w-5 text-orange-400" />
                      <span className="text-foreground">User Management</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Section Views */}
          {activeSection === 'admin' && user?.username === 'Admin' && (
            <div>
              <Button
                variant="ghost"
                onClick={() => setActiveSection('main')}
                className="mb-4 text-muted-foreground hover:text-foreground"
              >
                ← Back to Settings
              </Button>
              <UserManagement />
            </div>
          )}

          {activeSection === 'personalization' && (
            <div>
              <Button
                variant="ghost"
                onClick={() => setActiveSection('main')}
                className="mb-4 text-muted-foreground hover:text-foreground"
              >
                ← Back to Settings
              </Button>
              <Card className="zed-glass border-white/10">
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
            </div>
          )}

          {activeSection === 'notifications' && (
            <div>
              <Button
                variant="ghost"
                onClick={() => setActiveSection('main')}
                className="mb-4 text-muted-foreground hover:text-foreground"
              >
                ← Back to Settings
              </Button>
              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>Enable Notifications</span>
                      <Switch
                        checked={appSettings.notifications}
                        onCheckedChange={(checked) => setAppSettings({...appSettings, notifications: checked})}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === 'data' && (
            <div>
              <Button
                variant="ghost"
                onClick={() => setActiveSection('main')}
                className="mb-4 text-muted-foreground hover:text-foreground"
              >
                ← Back to Settings
              </Button>
              <Card className="zed-glass border-white/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Data Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">Manage your data privacy and control how your information is used.</p>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === 'archived' && (
            <div>
              <Button
                variant="ghost"
                onClick={() => setActiveSection('main')}
                className="mb-4 text-muted-foreground hover:text-foreground"
              >
                ← Back to Settings
              </Button>
              <Card className="zed-glass border-white/10">
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
            </div>
          )}

          {activeSection === 'security' && (
            <div>
              <Button
                variant="ghost"
                onClick={() => setActiveSection('main')}
                className="mb-4 text-muted-foreground hover:text-foreground"
              >
                ← Back to Settings
              </Button>
              
              {user?.username === 'Admin' ? (
                <AdminSecuritySettings />
              ) : (
                <Card className="zed-glass border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lock className="h-5 w-5" />
                      Security
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-sm text-muted-foreground space-y-2">
                        <p>• Session expires in 45 minutes of inactivity</p>
                        <p>• Enhanced security with device verification</p>
                        <p>• Multi-factor authentication enabled</p>
                        <p>• Username: <span className="text-foreground font-medium">{user?.username || "user"}</span></p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}