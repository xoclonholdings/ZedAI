import { Eye, EyeOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUTH_CONFIG } from "@shared/authConfig";

type AuthFormProps = {
  username: string;
  password: string;
  securePhrase: string;
  showPassword: boolean;
  showSecondaryAuth: boolean;
  isLoading: boolean;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSecurePhraseChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
};

export default function AuthForm({
  username,
  password,
  securePhrase,
  showPassword,
  showSecondaryAuth,
  isLoading,
  onUsernameChange,
  onPasswordChange,
  onSecurePhraseChange,
  onTogglePassword,
  onSubmit,
  onBack,
}: AuthFormProps) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Username</label>
        <Input
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          className="h-11 border-gray-700 bg-gray-950 text-white placeholder:text-gray-500 focus-visible:ring-purple-500"
          disabled={isLoading || showSecondaryAuth}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-white">Password</label>
        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            placeholder="Enter password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            className="h-11 border-gray-700 bg-gray-950 pr-10 text-white placeholder:text-gray-500 focus-visible:ring-purple-500"
            disabled={isLoading || showSecondaryAuth}
          />
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-white"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {showSecondaryAuth && (
        <div className="space-y-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
          <p className="text-sm text-yellow-300">
            Admin verification required. Enter secure phrase.
          </p>
          <Input
            type="password"
            placeholder={AUTH_CONFIG.securePhrasePlaceholder}
            value={securePhrase}
            onChange={(e) => onSecurePhraseChange(e.target.value)}
            className="h-11 border-yellow-500/30 bg-gray-950 text-white placeholder:text-gray-500 focus-visible:ring-yellow-500"
            disabled={isLoading}
          />
        </div>
      )}

      <Button
        type="submit"
        className="h-11 w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700"
        disabled={isLoading}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} />
          <span>
            {isLoading
              ? "Signing in..."
              : showSecondaryAuth
                ? "Verify Access"
                : "Sign In"}
          </span>
        </div>
      </Button>

      {showSecondaryAuth && (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full border-gray-700 bg-transparent text-white hover:bg-gray-900"
          onClick={onBack}
          disabled={isLoading}
        >
          Back
        </Button>
      )}
    </form>
  );
}