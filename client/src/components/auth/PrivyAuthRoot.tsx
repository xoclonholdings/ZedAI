import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import type { ReactNode } from "react";

import { zarLogoSrc } from "@/lib/zarLogo";

import { AuthProvider, type ExternalAuthAdapter } from "./AuthContext";

export const privyAppId = import.meta.env.VITE_PRIVY_APP_ID?.trim() || "";
export const isPrivyClientConfigured = Boolean(privyAppId);

function PrivyBackedAuthProvider({ children }: { children: ReactNode }) {
  const {
    ready,
    authenticated,
    user,
    getAccessToken,
    logout,
  } = usePrivy();
  const externalAuth: ExternalAuthAdapter = {
    ready,
    authenticated,
    userId: user?.id || null,
    getAccessToken,
    logout,
  };

  return <AuthProvider externalAuth={externalAuth}>{children}</AuthProvider>;
}

export function PrivyAuthRoot({ children }: { children: ReactNode }) {
  if (!isPrivyClientConfigured) {
    return <AuthProvider>{children}</AuthProvider>;
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email"],
        appearance: {
          theme: "dark",
          accentColor: "#00f0ff",
          logo: zarLogoSrc,
        },
      }}
    >
      <PrivyBackedAuthProvider>{children}</PrivyBackedAuthProvider>
    </PrivyProvider>
  );
}
