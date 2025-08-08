// Mock signal hook for now
export function useSignal() {
  return {
    signalStrength: 100,
    connected: true,
    checkConnection: async () => true,
    error: null,
    loading: false,
  };
}
