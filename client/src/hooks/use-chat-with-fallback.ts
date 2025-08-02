import { useChat } from './use-chat';
import { useChatMock } from './use-chat-mock';
import { useChatMinimal } from './use-chat-minimal';

export function useChatWithFallback(conversationId?: string) {
  const USE_MOCK_MODE = true; // Temporarily enable mock mode while fixing server
  const USE_MINIMAL_SERVER = false; // Use minimal server instead of full server
  
  const realChat = useChat(conversationId);
  const mockChat = useChatMock();
  const minimalChat = useChatMinimal();
  
  if (USE_MOCK_MODE) {
    return {
      sendMessage: mockChat.sendMessage,
      messages: mockChat.messages,
      isStreaming: mockChat.isLoading,
      streamingMessage: '',
      stopStreaming: () => {},
      clearMessages: mockChat.clearMessages,
      isMockMode: true,
    };
  }

  if (USE_MINIMAL_SERVER) {
    return {
      ...minimalChat,
      isMockMode: false,
      isMinimalMode: true,
    };
  }
  
  return {
    ...realChat,
    messages: [], // This would come from a query in real mode
    clearMessages: () => {},
    isMockMode: false,
  };
}
