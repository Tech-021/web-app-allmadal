"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deletePasskey,
  fetchPasskeyConfig,
  listPasskeys,
  passkeyUserMessage,
  PasskeyCredentialSummary,
  registerPasskey,
  shouldOfferPasskeySignIn,
} from "@/app/lib/passkey";
import { useToast } from "@/app/components/toast-context";
import ui from "@/app/components/workspace-ui.module.css";

export function PasskeySettings() {
  const { showToast, confirmDialog } = useToast();
  const [credentials, setCredentials] = useState<PasskeyCredentialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    void fetchPasskeyConfig().then((config) => {
      setEnabled(shouldOfferPasskeySignIn(config));
    });
  }, []);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setCredentials(await listPasskeys());
    } catch (e) {
      const msg = passkeyUserMessage(e);
      if (!/not enabled/i.test(msg)) {
        showToast(msg, "error");
      }
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addPasskey(attachment?: "platform" | "cross-platform") {
    setRegistering(true);
    try {
      const label =
        attachment === "platform"
          ? `This PC ${new Date().toLocaleDateString()}`
          : attachment === "cross-platform"
            ? `Security key ${new Date().toLocaleDateString()}`
            : `Device ${new Date().toLocaleDateString()}`;
      const next = await registerPasskey(label, attachment);
      setCredentials(next);
      showToast(
        attachment === "platform"
          ? "PC passkey added. Use “Sign in with passkey” on the login page with Windows Hello."
          : "Passkey added. You can sign in with Windows Hello, Touch ID, or a security key.",
        "success",
      );
    } catch (e) {
      showToast(passkeyUserMessage(e), "error");
    } finally {
      setRegistering(false);
    }
  }

  async function removePasskey(id: number, name: string) {
    const ok = await confirmDialog({
      title: "Remove passkey?",
      message: `Remove "${name}"? You will need password or another passkey to sign in.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;

    try {
      await deletePasskey(id);
      setCredentials((prev) => prev.filter((c) => c.id !== id));
      showToast("Passkey removed.", "success");
    } catch (e) {
      showToast(passkeyUserMessage(e), "error");
    }
  }

  if (!enabled) {
    return (
      <div
        style={{
          marginTop: 24,
          padding: "20px 24px",
          background: "#f8fafc",
          borderRadius: 16,
          border: "1px solid #e2e8f0",
        }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>Passkeys</h3>
        <p className={ui.muted} style={{ fontSize: 12 }}>
          Passkeys are disabled on the server or not available in this browser (use HTTPS or localhost).
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 24,
        padding: "20px 24px",
        background: "#f8fafc",
        borderRadius: 16,
        border: "1px solid #e2e8f0",
      }}
    >
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
        Passkeys
      </h3>
      <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
        Windows Hello on this PC only appears after you add a passkey here (not from the login screen).
        Use &quot;Add passkey on this PC&quot; first, then &quot;Sign in with passkey&quot; when you log out.
      </p>

      {loading ? (
        <p className={ui.muted} style={{ fontSize: 12 }}>Loading passkeys…</p>
      ) : credentials.length === 0 ? (
        <p className={ui.muted} style={{ fontSize: 12, marginBottom: 12 }}>No passkeys on this account yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {credentials.map((c) => (
            <li
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 12px",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                fontSize: 12,
              }}
            >
              <div>
                <strong style={{ color: "#0f172a" }}>{c.friendlyName || "Passkey"}</strong>
                <div className={ui.muted} style={{ marginTop: 2 }}>
                  {c.deviceType === "singleDevice" ? "This device" : c.deviceType || "Passkey"}
                  {c.backedUp ? " · synced" : ""}
                  {c.lastUsedAt ? ` · Last used ${new Date(c.lastUsedAt).toLocaleDateString()}` : ""}
                </div>
              </div>
              <button
                type="button"
                className={ui.secondary}
                style={{ fontSize: 11, padding: "6px 10px" }}
                onClick={() => void removePasskey(c.id, c.friendlyName || "Passkey")}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          className={ui.secondary}
          disabled={registering}
          onClick={() => void addPasskey("platform")}
          style={{ fontWeight: 700 }}
        >
          {registering ? "Follow the browser prompt…" : "Add passkey on this PC"}
        </button>
        <button
          type="button"
          className={ui.secondary}
          disabled={registering}
          onClick={() => void addPasskey("cross-platform")}
          style={{ fontWeight: 600 }}
        >
          Phone or USB security key
        </button>
      </div>
    </div>
  );
}
