export function NexusConversationEmptyState() {
  return (
    <div className="flex min-h-[34vh] items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/50">
          ZAR
        </div>
        <div className="mt-2 text-xl font-semibold tracking-tight text-white">
          Ask ZAR
        </div>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Start a conversation from the current Nexus context.
        </p>
      </div>
    </div>
  );
}
