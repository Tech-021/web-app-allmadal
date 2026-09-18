"use client";

import { FormEvent, useEffect, useState } from "react";
import { useBusiness } from "@/app/components/business-context";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { logActivity } from "@/app/lib/logger";
import ui from "@/app/components/workspace-ui.module.css";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { activeBusiness, reloadBusinesses } = useBusiness();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    business: activeBusiness?.name || "",
  });

  useEffect(() => {
    setForm({
      name: user?.name || "",
      email: user?.email || "",
      business: activeBusiness?.name || "",
    });
  }, [user?.name, user?.email, activeBusiness?.name]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!activeBusiness) return;
    setSaving(true);
    try {
      const [profile, business] = await Promise.all([
        api<{ user: { id?: number; fullName?: string; email: string; role: "admin" | "staff" } }>("/auth/me", {
          method: "PATCH",
          body: JSON.stringify({ fullName: form.name, email: form.email }),
        }),
        api<{ business: NonNullable<typeof activeBusiness> }>(`/business/${activeBusiness.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.business }),
        }),
      ]);

      updateUser({
        id: profile.user.id,
        name: profile.user.fullName || form.name,
        email: profile.user.email,
        role: profile.user.role,
      });

      await reloadBusinesses();

      setForm({
        name: profile.user.fullName || form.name,
        email: profile.user.email,
        business: business.business.name,
      });

      showToast("Settings updated successfully.", "success");

      logActivity(
        "SETTINGS_UPDATE",
        "Settings",
        `Updated account & store settings for '${business.business.name}'`,
        business.business.name,
        { name: form.name, email: form.email, business: business.business.name }
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not update settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Workspace</label>
          <h1>Settings</h1>
          <p>Update your account and active business details.</p>
        </div>
      </div>

      <form className={`${ui.panel} max-w-2xl`} onSubmit={submit}>
        <div className={ui.formGrid}>
          <div className={ui.field}>
            <label>Full Name</label>
            <input
              className={ui.input}
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className={ui.field}>
            <label>Email Address</label>
            <input
              className={ui.input}
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className={`${ui.field} ${ui.span2}`}>
            <label>Business Name</label>
            <input
              className={ui.input}
              required
              value={form.business}
              onChange={(e) => setForm({ ...form, business: e.target.value })}
            />
          </div>

          <div className={ui.field}>
            <label>Role</label>
            <input
              className={ui.input}
              value={user?.role === "admin" ? "Store Owner" : "Staff"}
              readOnly
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Role permissions remain controlled by the owner in Staff &amp; Permissions.
        </p>

        <div className={ui.formActions}>
          <button className={ui.primary} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </WorkspaceShell>
  );
}
