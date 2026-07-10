import { useLocation } from "wouter";
import { Archive, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UseAuth";
import { persistWorkspace } from "@/lib/workspaceContext";

interface ChatHeaderProps {
  isMobile?: boolean;
  onOpenSidebar?: () => void;
  canArchive?: boolean;
  onArchiveConversation?: () => void;
  workspaceLabel?: string | null;
  workspaceSlug?: string | null;
}

export default function ChatHeader({
  isMobile = false,
  onOpenSidebar,
  canArchive = false,
  onArchiveConversation,
  workspaceLabel,
  workspaceSlug,
}: ChatHeaderProps) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const compact = !!user?.personalization?.compactMessages;

  const exitWorkspace = () => {
    persistWorkspace(null);
    navigate("/chat");
  };

  return (
    <div
      className={`flex items-center justify-between border-b border-white/10 zed-glass relative z-10 flex-shrink-0 pt-safe ${
        compact ? "px-3 pb-2.5 md:px-4 md:pb-3" : "px-4 pb-3 md:px-6 md:pb-4"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {isMobile && onOpenSidebar && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenSidebar}
            className={`${compact ? "w-8 h-8" : "w-9 h-9"} zed-button rounded-xl p-0 text-muted-foreground hover:text-foreground shrink-0`}
          >
            <Menu size={20} />
          </Button>
        )}
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-white/45">
            ZED
          </div>
          {workspaceLabel ? (
            <button
              type="button"
              onClick={() => workspaceSlug && navigate(`/workspaces/${workspaceSlug}`)}
              className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/[0.08] px-2.5 py-0.5 text-[11.5px] font-medium text-cyan-100 hover:bg-cyan-400/[0.14] transition-colors"
              title="Open workspace"
            >
              In {workspaceLabel}
              <X
                size={11}
                className="text-cyan-200/70 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  exitWorkspace();
                }}
              />
            </button>
          ) : (
            <div className="text-[15px] font-semibold text-foreground leading-tight tracking-tight">
              Ready
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/home")}
          className="h-8 px-2.5 rounded-lg text-[11.5px] text-white/60 hover:text-white/90"
          title="Home"
        >
          Home
        </Button>
        {canArchive && onArchiveConversation ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onArchiveConversation}
            className={`${compact ? "h-8 px-2" : "h-9 px-3"} zed-button rounded-xl text-muted-foreground hover:text-orange-300`}
            title="Archive this chat"
          >
            <Archive size={15} className="md:mr-1.5" />
            <span className="hidden md:inline text-[12px]">Archive</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
