import { useState } from "react";

import { useAuth } from "@/components/auth/UseAuth";
import { Card, CardContent } from "@/components/ui/card";
import { zedLogoSrc } from "@/lib/zedLogo";

import { AdminEmailForm } from "./login/AdminEmailForm";
import { SecurePhraseForm } from "./login/SecurePhraseForm";
import { UserLoginForm } from "./login/UserLoginForm";

export default function Login() {
  const [useAdminLogin, setUseAdminLogin] = useState(true);
  const [showPhraseFallback, setShowPhraseFallback] = useState(false);
  const { refresh } = useAuth() as { refresh: () => Promise<void> };

  function switchTab(toAdmin: boolean) {
    setUseAdminLogin(toAdmin);
    setShowPhraseFallback(false);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-20 top-20 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl zed-float" />
        <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-fuchsia-500/5 blur-3xl zed-float zed-delay-4s" />
        <div className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl zed-float zed-delay-2s" />
      </div>

      <div className="absolute inset-0 opacity-5 pointer-events-none zed-grid-overlay" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(255,61,154,0.28),_transparent_60%)] blur-2xl" />
            <img
              src={zedLogoSrc}
              alt="ZED"
              className="relative z-10 h-24 w-24 object-contain drop-shadow-[0_0_28px_rgba(0,240,255,0.28)]"
            />
          </div>
        </div>

        <Card className="zed-glass border-white/10">
          <CardContent className="space-y-4 pt-6">
            <div className="flex overflow-hidden rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => switchTab(true)}
                className={`flex-1 px-4 py-2 text-sm ${useAdminLogin ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              >
                Admin Email
              </button>
              <button
                type="button"
                onClick={() => switchTab(false)}
                className={`flex-1 px-4 py-2 text-sm ${!useAdminLogin ? "bg-white/10 text-white" : "text-muted-foreground"}`}
              >
                User Login
              </button>
            </div>

            {useAdminLogin && <AdminEmailForm onSuccess={refresh} />}

            {useAdminLogin && (
              <div className="border-t border-white/10 pt-3">
                {!showPhraseFallback ? (
                  <button
                    type="button"
                    onClick={() => setShowPhraseFallback(true)}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Can't access email? Use admin secure phrase
                  </button>
                ) : (
                  <SecurePhraseForm
                    onSuccess={refresh}
                    onCancel={() => setShowPhraseFallback(false)}
                  />
                )}
              </div>
            )}

            {!useAdminLogin && <UserLoginForm onSuccess={refresh} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
