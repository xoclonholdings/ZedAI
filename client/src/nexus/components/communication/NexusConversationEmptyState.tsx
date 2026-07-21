export function NexusConversationEmptyState() {
  return (
    <div className="flex h-full min-h-[96px] items-center justify-center px-4">
      <div className="w-full max-w-lg text-center">
        <div className="text-xl font-semibold tracking-tight text-white">
          Ask ZAR
        </div>
        <p className="mt-2 text-sm leading-6 text-white/55">
          Start a conversation from the current Nexus context.
        </p>
      </div>
    </div>
  );
}
