import {
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import { getAuthItem, tokenKey } from "@/app/lib/auth-session";
import { api } from "@/app/lib/api";

const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

export type PasskeyPublicConfig = {
  enabled: boolean;
  rpId: string;
  rpName: string;
  origins: string[];
  authenticatorTypes: string[];
  userVerification: string;
  residentKey: string;
};

export type PasskeyCredentialSummary = {
  id: number;
  friendlyName: string | null;
  deviceType: string | null;
  backedUp: boolean;
  transports: string[] | null;
  createdAt: string;
  lastUsedAt: string | null;
};

export type PasskeySessionPayload = {
  token?: string;
  access_token?: string;
  accessToken?: string;
  user?: unknown;
  businesses?: unknown[];
  hasBusiness?: boolean;
  activeBusinessId?: number | string | null;
};

function parseError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const msg = record.message || record.error || record.detail;
    if (typeof msg === "string" && msg.length > 0) return msg;
  }
  if (status === 503) return "Passkey sign-in is not enabled on this server.";
  if (status === 403) return "This site is not allowed for passkeys. Check WEBAUTHN_ORIGINS on the API.";
  return `Passkey request failed (${status}).`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(parseError(payload, response.status));
  }
  return payload as T;
}

/** Secure context + WebAuthn API (desktop, laptop, mobile browsers). */
export function isWebAuthnAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  return typeof window.PublicKeyCredential !== "undefined";
}

export async function fetchPasskeyConfig(): Promise<PasskeyPublicConfig | null> {
  if (!baseUrl) return null;
  try {
    const res = await fetch(`${baseUrl}/auth/passkey/config`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PasskeyPublicConfig;
  } catch {
    return null;
  }
}

export function shouldOfferPasskeySignIn(config: PasskeyPublicConfig | null): boolean {
  return Boolean(config?.enabled && isWebAuthnAvailable());
}

export type PasskeyRegistrationAttachment = "platform" | "cross-platform";

export async function registerPasskey(
  friendlyName?: string,
  attachment?: PasskeyRegistrationAttachment,
): Promise<PasskeyCredentialSummary[]> {
  const token = getAuthItem(tokenKey);
  if (!baseUrl || !token) {
    throw new Error("Your session is not available. Please sign in again.");
  }

  const registerBody =
    attachment === "platform" || attachment === "cross-platform" ? { attachment } : undefined;

  const options = await parseResponse<PublicKeyCredentialCreationOptionsJSON>(
    await fetch(`${baseUrl}/auth/passkey/register/options`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...(registerBody ? { "Content-Type": "application/json" } : {}),
      },
      body: registerBody ? JSON.stringify(registerBody) : undefined,
    }),
  );

  const registration = await startRegistration({ optionsJSON: options });

  const verified = await parseResponse<{ credentials: PasskeyCredentialSummary[] }>(
    await fetch(`${baseUrl}/auth/passkey/register/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...registration,
        friendlyName: friendlyName?.trim() || undefined,
      }),
    }),
  );

  return verified.credentials ?? [];
}

export async function signInWithPasskey(email?: string): Promise<PasskeySessionPayload> {
  if (!baseUrl) throw new Error("Backend URL is not configured.");

  const body = email?.trim() ? { email: email.trim().toLowerCase() } : {};
  const options = await parseResponse<PublicKeyCredentialRequestOptionsJSON>(
    await fetch(`${baseUrl}/auth/passkey/sign-in/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

  const authentication = await startAuthentication({ optionsJSON: options });

  return parseResponse<PasskeySessionPayload>(
    await fetch(`${baseUrl}/auth/passkey/sign-in/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authentication),
    }),
  );
}

export async function listPasskeys(): Promise<PasskeyCredentialSummary[]> {
  const res = await api<{ credentials: PasskeyCredentialSummary[] }>("/auth/passkey/credentials");
  return res.credentials ?? [];
}

export async function deletePasskey(id: number): Promise<void> {
  await api(`/auth/passkey/credentials/${id}`, { method: "DELETE" });
}

export function passkeyUserMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "NotAllowedError") {
      return "Passkey was cancelled or not allowed. Try again or use password sign-in.";
    }
    return error.message;
  }
  return "Passkey operation failed.";
}
