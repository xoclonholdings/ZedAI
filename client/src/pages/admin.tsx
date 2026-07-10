import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/UseAuth";
import AdminNav from "@/components/admin/AdminNav";
import SettingsSection from "@/components/admin/sections/SettingsSection";
import KnowledgeSection from "@/components/admin/sections/KnowledgeSection";
import AdvancedSection from "@/components/admin/sections/AdvancedSection";
import IntegrationsSection from "@/components/admin/sections/IntegrationsSection";
import ApprovalsSection from "@/components/admin/sections/ApprovalsSection";
import LogsSection from "@/components/admin/sections/LogsSection";
import SecuritySection from "@/components/admin/sections/SecuritySection";
import type { AdminSection } from "@/components/admin/types";
import zedLogo from "@assets/Zed_logo.png";

export default function Admin() {
  const [, navigate] = useLocation();
  const { user } = useAuth() as { user?: any };
  const [section, setSection] = useState<AdminSection>("settings");

  // Approvals are managed at the shell so the nav-tab badge stays accurate
  // even when the user isn't on the Approvals tab.
  const [approvals, setApprovals] = useState<any[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  async function fetchApprovals() {
    setApprovalsLoading(true);
    try {
      const res = await fetch("/api/admin/approval-queue", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setApprovals((data.entries || []).reverse());
      }
    } catch {}
    setApprovalsLoading(false);
  }

  async function resolveApproval(id: string, action: "approve" | "reject") {
    try {
      const res = await fetch(
        `/api/admin/${action === "approve" ? "approve" : "reject"}/${id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        },
      );
      if (res.ok) {
        setApprovals((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: action === "approve" ? "approved" : "rejected",
                  resolvedAt: new Date().toISOString(),
                }
              : e,
          ),
        );
      }
    } catch {}
  }

  useEffect(() => {
    void fetchApprovals();
    const interval = window.setInterval(fetchApprovals, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const pendingCount = approvals.filter((e) => e.status === "pending").length;

  return (
    <div className="min-h-screen w-screen max-w-[100vw] overflow-x-hidden bg-black text-white">
      <div className="sticky top-0 z-20 flex w-full max-w-[100vw] items-center justify-between gap-3 overflow-hidden border-b border-white/10 px-4 pb-3 pt-safe-sm zed-glass">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/chat")}
            className="shrink-0 text-muted-foreground hover:text-foreground zed-button rounded-xl"
          >
            <ChevronLeft size={16} className="mr-1" />
            Back
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <img src={zedLogo} alt="ZED" className="h-6 w-6 shrink-0 object-contain" />
            <span className="truncate text-sm font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent sm:text-base">
              ZED Admin
            </span>
          </div>
        </div>
        <Badge className="zed-glass max-w-[36vw] shrink-0 overflow-hidden border-purple-500/30 text-purple-300 text-xs">
          <Shield size={10} className="mr-1 shrink-0" />
          <span className="truncate">{user?.username || "Admin"}</span>
        </Badge>
      </div>

      <AdminNav active={section} onSelect={setSection} pendingApprovals={pendingCount} />

      <div className="mx-auto w-full max-w-[100vw] space-y-6 overflow-x-hidden p-4 md:max-w-5xl md:p-6">
        {section === "settings" && <SettingsSection />}
        {section === "advanced" && <AdvancedSection />}
        {section === "knowledge" && <KnowledgeSection />}
        {section === "integrations" && <IntegrationsSection />}
        {section === "approvals" && (
          <ApprovalsSection
            approvals={approvals}
            loading={approvalsLoading}
            onRefresh={fetchApprovals}
            onResolve={resolveApproval}
          />
        )}
        {section === "logs" && <LogsSection />}
        {section === "security" && <SecuritySection />}
      </div>
    </div>
  );
}
