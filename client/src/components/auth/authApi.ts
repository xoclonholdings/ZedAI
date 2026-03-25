import { AUTH_CONFIG } from "@shared/authConfig";

export type LoginInput = {
  username: string;
  password: string;
  securePhrase?: string;
};

export type LoginResult = {
  success: boolean;
  requiresSecondaryAuth?: boolean;
  error?: string;
  user?: any;
};

export async function loginRequest(input: LoginInput): Promise<LoginResult> {
  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });

    const data = await response.json();

    if (data?.success) {
      return {
        success: true,
        user: data.user,
      };
    }

    if (data?.requiresSecondaryAuth) {
      return {
        success: false,
        requiresSecondaryAuth: true,
        error:
          data.message ||
          `${AUTH_CONFIG.adminVerificationTitle} required`,
      };
    }

    return {
      success: false,
      error: data?.error || "Login failed",
    };
  } catch {
    return {
      success: false,
      error: "Backend unavailable. Start the server to log in.",
    };
  }
}