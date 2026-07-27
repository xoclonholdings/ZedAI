import { Archive } from "lucide-react";

export function NexusConversationHeader({
  title,
  conversationId,
  onArchive,
}: {
  readonly title: string;
  readonly conversationId?: string;
  readonly onArchive: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-3 py-2.5 md:px-4">
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-cyan-100/48">
          Conversation
        </div>
        <div className="truncate text-sm font-medium text-white/78">{title}</div>
      </div>
      {conversationId ? (
        <button
          type="button"
          onClick={onArchive}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-[12px] text-white/62 transition hover:border-orange-200/30 hover:text-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-200/40"
          aria-label="Archive conversation"
        >
          <Archive size={13} />
          <span className="hidden sm:inline">Archive</span>
        </button>
      ) : null}
    </div>
  );
}
