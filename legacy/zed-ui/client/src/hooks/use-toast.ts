interface ToastProps {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

export function useToast() {
  const toast = (props: ToastProps) => {
    console.log("Toast:", props);
    // Simple implementation - just log for now
    // In a real app, you'd want to show actual toast notifications
  };

  return { toast };
}