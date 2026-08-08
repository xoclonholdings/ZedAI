import type { NexysConversationController } from "../../communication/useNexysConversationController";
import { NexysAttachmentTray } from "./NexysAttachmentTray";
import { NexysConversationHeader } from "./NexysConversationHeader";
import { NexysFileUpload } from "./NexysFileUpload";
import { NexysMessageComposer } from "./NexysMessageComposer";
import { NexysMessageList } from "./NexysMessageList";

export function NexysConversationRuntime({
  controller,
}: {
  readonly controller: NexysConversationController;
}) {
  return (
    <div
      data-nexys-conversation-runtime="true"
      className="flex min-h-0 flex-1 overflow-hidden rounded-2xl bg-black/20"
    >
      <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        {controller.conversationId && (
          <NexysConversationHeader
            title={controller.title}
            conversationId={controller.conversationId}
            onArchive={() => void controller.archiveConversation()}
          />
        )}

        <NexysMessageList
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
          <NexysFileUpload
            conversationId={controller.activeUploadConversationId}
            onUpload={controller.handleFileUpload}
            onClose={controller.closeFileUpload}
          />
        ) : null}

        <NexysAttachmentTray files={controller.files} />

        <div className="z-10 flex-shrink-0 border-t border-white/[0.06] px-3 pb-safe pt-3 md:px-4 md:pt-4">
          <div className="mx-auto max-w-4xl">
            <NexysMessageComposer
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
