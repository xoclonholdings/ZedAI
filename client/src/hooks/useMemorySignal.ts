import { useState } from "react";

export function useMemorySignal() {
  const [conversations, setConversations] = useState([]);
  const [memoryStats, setMemoryStats] = useState({});
  const [zebulonConnection, setZebulonConnection] = useState("disconnected");
  const [loading] = useState(false); // Remove setLoading
  const [error, setError] = useState<string | null>(null);

  // Stubs for now
  const fetchConversations = async () => setConversations([]);
  const syncWithZebulon = async () => setMemoryStats({});
  const searchConversations = async (_q: string) => [];
  const checkConnection = async () => setZebulonConnection("connected");
  const clearError = () => setError(null);

  return {
    conversations,
    memoryStats,
    zebulonConnection,
    loading,
    error,
    fetchConversations,
    syncWithZebulon,
    searchConversations,
    checkConnection,
    clearError,
  };
}
