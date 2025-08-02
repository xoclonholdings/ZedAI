import { useState } from 'react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  source?: string;
}

export function useChatMinimal() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m ZED, your AI assistant. The server is now running!',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      source: 'ZED_MINIMAL'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      role: 'user',
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content.trim() }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      
      // Add ZED response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.message || 'ZED received your message.',
        role: 'assistant',
        timestamp: data.timestamp || new Date().toISOString(),
        source: data.source || 'ZED'
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: `ZED: I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        role: 'assistant',
        timestamp: new Date().toISOString(),
        source: 'ZED_ERROR'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessages = () => {
    setMessages([{
      id: '1',
      content: 'Hello! I\'m ZED, your AI assistant. Chat cleared.',
      role: 'assistant',
      timestamp: new Date().toISOString(),
      source: 'ZED_MINIMAL'
    }]);
  };

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    isStreaming: isLoading,
    streamingMessage: '',
    stopStreaming: () => {},
  };
}
