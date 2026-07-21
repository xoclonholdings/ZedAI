import type { NexusConversationController } from "../../communication/useNexusConversationController";
import { NexusAttachmentTray } from "./NexusAttachmentTray";
import { NexusConversationHeader } from "./NexusConversationHeader";
import { NexusFileUpload } from "./NexusFileUpload";
import { NexusMessageComposer } from "./NexusMessageComposer";
import { NexusMessageList } from "./NexusMessageList";

export function NexusConversationRuntime({
  controller,
}: {
  readonly controller: NexusConversationController;
}) {
  return (
    <div
      data-nexus-conversation-runtime="true"
      className="flex min-h-[480px] flex-1 overflow-hidden rounded-2xl border border-white/[0.08] bg-black/30"
    >
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <NexusConversationHeader
          title={controller.title}
          conversationId={controller.conversationId}
          onArchive={() => void controller.archiveConversation()}
        />

        <NexusMessageList
          messages={controller.messages}
          isStreaming={controller.isStreaming}
          streamingMessage={controller.streamingMessage}
          hasStartedTyping={controller.hasStartedTyping}
          messagesEndRef={controller.messagesEndRef}
          onCopyMessage={(message) => void controller.copyMessage(message)}
          onEditMessage={controller.editMessage}
          compact={controller.compactMessages}
          fontSize={controller.fontSize}
          showTimestamps={controller.showTimestamps}
        />

        {controller.runtimeError ? (
          <div className="mx-3 mb-2 rounded-xl border border-red-300/20 bg-red-500/[0.08] px-3 py-2 text-sm text-red-100 md:mx-4">
            {controller.runtimeError}
          </div>
        ) : null}

        {controller.showFileUpload && controller.activeUploadConversationId ? (
          <NexusFileUpload
            conversationId={controller.activeUploadConversationId}
            onUpload={controller.handleFileUpload}
            onClose={controller.closeFileUpload}
          />
        ) : null}

        <NexusAttachmentTray files={controller.files} />

        <div className="z-10 flex-shrink-0 border-t border-white/10 px-3 pb-safe pt-3 md:px-4 md:pt-4">
          <div className="mx-auto max-w-4xl">
            <NexusMessageComposer
              value={controller.composerValue}
              onValueChange={controller.setComposerValue}
              onSend={(message) => void controller.sendMessage(message)}
              onAbort={controller.abort}
              isStreaming={controller.isStreaming}
              onOpenFileUpload={() => void controller.openFileUpload()}
              editModeLabel={controller.editingMessageId ? "Editing message draft" : null}
              onCancelEdit={controller.editingMessageId ? controller.cancelEdit : undefined}
              compact={controller.compactMessages}
              fontSize={controller.fontSize}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
