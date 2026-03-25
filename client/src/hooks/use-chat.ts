import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

interface StreamMessage {
  content: string;
  done: boolean;
}

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
      const response = await fetch(`/api/conversations/${conversationId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      let fullMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: StreamMessage = JSON.parse(line.slice(6));
              
              if (data.content) {
                fullMessage += data.content;
                setStreamingMessage(fullMessage);
              }

              if (data.done) {
                setIsStreaming(false);
                setStreamingMessage('');
                
                // Refresh queries
                queryClient.invalidateQueries({
                  queryKey: ['/api/conversations', conversationId, 'messages'],
                });
                queryClient.invalidateQueries({
                  queryKey: ['/api/conversations'],
                });
                
                return;
              }
            } catch (e) {
              // Silent error handling for malformed SSE data
            }
          }
        }
      }
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

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStreamingMessage('');
    }
  }, []);

  return {
    sendMessage,
    stopStreaming,
    isStreaming,
    streamingMessage,
  };
}
