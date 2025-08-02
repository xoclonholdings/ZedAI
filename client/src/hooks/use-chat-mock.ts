import { useState } from "react";

export function useChatMock() {
  const [messages, setMessages] = useState([
    {
      id: "1",
      message: "Hello! I'm ZED, your AI assistant. The system is running in mock mode while we establish server connection.",
      timestamp: new Date().toISOString(),
      source: "ZED_MOCK",
      isUser: false
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      message: message.trim(),
      timestamp: new Date().toISOString(),
      source: "USER",
      isUser: true
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse = {
        id: (Date.now() + 1).toString(),
        message: `ZED: I received your message "${message}". This is a mock response while we establish server connection. The system architecture includes unified AI routing with Ollama→OpenAI→Julius fallback chain, all under the ZED identity.`,
        timestamp: new Date().toISOString(),
        source: "ZED_MOCK",
        isUser: false
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsLoading(false);
    }, 1000);
  };

  const clearMessages = () => {
    setMessages([{
      id: "1",
      message: "Hello! I'm ZED, your AI assistant. Chat cleared.",
      timestamp: new Date().toISOString(),
      source: "ZED_MOCK",
      isUser: false
    }]);
  };

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
