import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth/UseAuth";
import type { NexysDockControlId } from "../dock/nexysDock";

interface DockNotification {
  id: string;
  approval_required: boolean;
  read: boolean;
  target_surface?: NexysDockControlId;
}

interface DockNotificationResponse {
  notifications: DockNotification[];
}

interface NexysDockAttentionValue {
  readonly hasAttention: (controlId: NexysDockControlId) => boolean;
  readonly attentionCount: (controlId: NexysDockControlId) => number;
  readonly acknowledgeReviewOnly: (controlId: NexysDockControlId) => Promise<void>;
}

const QUERY_KEY = ["/api/approval/notifications?unread=true"];
const NexysDockAttentionContext = createContext<NexysDockAttentionValue | null>(null);

/**
 * One attention source for every NEXYS Dock rendering. Approval-required
 * records remain lit until the decision is resolved; review-only records are
 * acknowledged when the user opens their destination surface.
 */
export function NexysDockAttentionProvider({ children }: { readonly children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery<DockNotificationResponse>({
    queryKey: QUERY_KEY,
    enabled: isAuthenticated,
    refetchInterval: 15_000,
    staleTime: 0,
  });

  const unread = useMemo(
    () => (data?.notifications ?? []).filter((notification) => !notification.read),
    [data?.notifications],
  );

  const attentionCount = useCallback((controlId: NexysDockControlId) => (
    unread.filter((notification) => (notification.target_surface ?? "task") === controlId).length
  ), [unread]);

  const hasAttention = useCallback(
    (controlId: NexysDockControlId) => attentionCount(controlId) > 0,
    [attentionCount],
  );

  const acknowledgeReviewOnly = useCallback(async (controlId: NexysDockControlId) => {
    const reviewOnly = unread.filter(
      (notification) =>
        (notification.target_surface ?? "task") === controlId &&
        !notification.approval_required,
    );
    if (reviewOnly.length === 0) return;
    await Promise.all(reviewOnly.map((notification) => fetch(
      `/api/approval/notifications/${notification.id}/read`,
      { method: "POST", credentials: "include" },
    )));
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient, unread]);

  const value = useMemo<NexysDockAttentionValue>(() => ({
    hasAttention,
    attentionCount,
    acknowledgeReviewOnly,
  }), [acknowledgeReviewOnly, attentionCount, hasAttention]);

  return (
    <NexysDockAttentionContext.Provider value={value}>
      {children}
    </NexysDockAttentionContext.Provider>
  );
}

export function useNexysDockAttention(): NexysDockAttentionValue {
  const value = useContext(NexysDockAttentionContext);
  if (!value) throw new Error("useNexysDockAttention must be used within NexysDockAttentionProvider");
  return value;
}
