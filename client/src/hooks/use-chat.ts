import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import { useChatMock } from './use-chat-mock';

interface StreamMessage {
  content: string;
  done: boolean;
}

interface ZEDResponse {
  response: string;
  assistant: string;
  success: boolean;
  error?: string;
}

// Unified ZED AI function - all requests go through /api/ask
const getZEDResponse = async (content: string): Promise<ZEDResponse> => {
  console.log('🧠 ZED: Processing user request...');
  
  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    return {
      response: data.response || 'ZED is processing your request...',
      assistant: 'ZED',
      success: true
    };
  } catch (error) {
    console.error('❌ Error communicating with ZED:', error);
    
    return {
      response: 'ZED is temporarily offline. Please try again.',
      assistant: 'ZED',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

export function useChat(conversationId?: string) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!conversationId) {
      throw new Error('No conversation ID provided');
    }

    setIsStreaming(true);
    setStreamingMessage('');

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // Send user message - backend will handle AI response
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content, 
          role: 'user' 
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setIsStreaming(false);
      setStreamingMessage('');
      
      // Refresh queries to get the new messages
      queryClient.invalidateQueries({
        queryKey: ['/api/conversations', conversationId, 'messages'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/conversations'],
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, don't show error
        return;
      }

      setIsStreaming(false);
      setStreamingMessage('');
      
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
      
      throw error;
    } finally {
      abortControllerRef.current = null;
    }
  }, [conversationId, queryClient, toast]);

  const appendMessage = useCallback(async (content: string, role: 'user' | 'assistant', metadata?: any): Promise<void> => {
    if (!conversationId) {
      throw new Error('No conversation ID provided');
    }

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content, 
          role,
          metadata: role === 'assistant' ? { assistant: 'ZED', ...metadata } : metadata
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to append ${role} message`);
      }

      // Refresh queries after successful message append
      queryClient.invalidateQueries({
        queryKey: ['/api/conversations', conversationId, 'messages'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/conversations'],
      });

    } catch (error) {
      console.error(`Error appending ${role} message:`, error);
      toast({
        title: 'Error',
        description: role === 'assistant' ? 'ZED encountered an error' : 'Failed to save your message',
        variant: 'destructive',
      });
      throw error;
    }
  }, [conversationId, queryClient, toast]);

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStreamingMessage('');
    }
  }, []);

  return {
    sendMessage,
    appendMessage,
    stopStreaming,
    isStreaming,
    streamingMessage,
  };
}
