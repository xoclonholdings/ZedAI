import { useState } from "react";

import { useAuth } from "@/components/auth/UseAuth";
import { isPrivyClientConfigured } from "@/components/auth/PrivyAuthRoot";
import { Card, CardContent } from "@/components/ui/card";
import { zarLogoSrc } from "@/lib/zarLogo";

import { SecurePhraseForm } from "./login/SecurePhraseForm";
import { PrivyLoginForm } from "./login/PrivyLoginForm";

export default function Login() {
  const [showPhraseFallback, setShowPhraseFallback] = useState(false);
  const { refresh, authError } = useAuth();

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-20 top-20 h-96 w-96 rounded-full bg-cyan-500/5 blur-3xl zar-float" />
        <div className="absolute bottom-20 right-20 h-80 w-80 rounded-full bg-fuchsia-500/5 blur-3xl zar-float zar-delay-4s" />
        <div className="absolute left-1/3 top-1/2 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl zar-float zar-delay-2s" />
      </div>

      <div className="absolute inset-0 opacity-5 pointer-events-none zar-grid-overlay" />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_top,_rgba(0,240,255,0.3),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(255,61,154,0.28),_transparent_60%)] blur-2xl" />
            <img
              src={zarLogoSrc}
              alt="ZAR"
              className="relative z-10 h-24 w-24 object-contain drop-shadow-[0_0_28px_rgba(0,240,255,0.28)]"
            />
          </div>
        </div>

        <Card className="zar-glass border-white/10">
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-semibold text-white">Sign in to ZAR</h1>
              <p className="text-sm text-muted-foreground">
                Use the code sent to your email.
              </p>
            </div>

            {isPrivyClientConfigured ? (
              <PrivyLoginForm onSuccess={refresh} />
            ) : (
              <p className="text-sm text-amber-300">
                Email sign-in is not configured on this deployment.
              </p>
            )}

            {authError ? <p className="text-sm text-red-400">{authError}</p> : null}

            <div className="border-t border-white/10 pt-3">
              {!showPhraseFallback ? (
                <button
                  type="button"
                  onClick={() => setShowPhraseFallback(true)}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Use admin secure phrase
                </button>
              ) : (
                <SecurePhraseForm
                  onSuccess={refresh}
                  onCancel={() => setShowPhraseFallback(false)}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
