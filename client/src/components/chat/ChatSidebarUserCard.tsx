import { Camera, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocalUser {
  id: string;
  displayName?: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

interface ChatSidebarUserCardProps {
  user?: LocalUser;
  isUploadingPicture: boolean;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLogout: () => void | Promise<void>;
  isLoggingOut?: boolean;
}

export default function ChatSidebarUserCard({
  user,
  isUploadingPicture,
  onUpload,
  onLogout,
  isLoggingOut = false,
}: ChatSidebarUserCardProps) {
  return (
    <div className="p-4 border-t border-white/10">
      <div className="flex items-center space-x-3">
        <div className="relative group">
          <div
            className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
            onClick={() =>
              document.getElementById("profile-upload")?.click()
            }
          >
            {user?.profileImageUrl ? (
              <img
                src={user.profileImageUrl}
                alt={user.firstName || "User"}
                className="w-full h-full object-cover"
              />
            ) : (
              <User size={20} className="text-white" />
            )}
          </div>

          <input
            id="profile-upload"
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploadingPicture}
            onChange={onUpload}
          />

          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center border-2 border-black group-hover:bg-purple-400 transition-colors">
            {isUploadingPicture ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera size={12} className="text-white" />
            )}
          </div>

          {/* Anchor the tooltip to the avatar's left edge so it grows
              rightward into the sidebar rather than getting clipped on
              the left by the sidebar's overflow boundary. Hidden on
              mobile where hover isn't meaningful and the camera badge
              already signals upload. */}
          <div className="hidden md:block absolute -top-8 left-0 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
            Click to upload photo
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {user?.displayName || user?.firstName || user?.username || "ZED"}
          </p>

          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-xs text-muted-foreground">Online</span>
          </div>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => void onLogout()}
        disabled={isLoggingOut}
        className="mt-3 w-full justify-start rounded-xl border border-white/10 bg-black/20 text-muted-foreground hover:bg-black/30 hover:text-foreground"
      >
        <LogOut size={14} className="mr-2" />
        {isLoggingOut ? "Logging out..." : "Logout"}
      </Button>
    </div>
  );
}
