"use client";

import { FormEvent, useEffect, useState, useRef } from "react";
import { useBusiness } from "@/app/components/business-context";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, resolveImageUrl, uploadProductImage } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { logActivity } from "@/app/lib/logger";
import ui from "@/app/components/workspace-ui.module.css";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { activeBusiness, reloadBusinesses } = useBusiness();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [allowDiscounts, setAllowDiscounts] = useState(true);

  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    business: activeBusiness?.name || "",
    mobileNumber: activeBusiness?.mobileNumber || "",
    whatsappNumber: activeBusiness?.whatsappNumber || "",
    address: activeBusiness?.address || "",
    city: activeBusiness?.city || "",
  });

  useEffect(() => {
    setForm({
      name: user?.name || "",
      email: user?.email || "",
      business: activeBusiness?.name || "",
      mobileNumber: activeBusiness?.mobileNumber || "",
      whatsappNumber: activeBusiness?.whatsappNumber || "",
      address: activeBusiness?.address || "",
      city: activeBusiness?.city || "",
    });
    setLogoUrl(activeBusiness?.logoUrl || "");
    setAllowDiscounts(activeBusiness?.allowDiscounts !== false);
  }, [user?.name, user?.email, activeBusiness]);

  // Handle Logo File Upload
  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      showToast("Logo file size must be under 3MB.", "error");
      return;
    }

    setLogoUploading(true);
    try {
      // Upload via backend image service
      const res = await uploadProductImage(file);
      setLogoUrl(res.url);
      showToast("Logo uploaded. Click 'Save Changes' to apply.", "success");
    } catch {
      // Fallback to Base64 data URL
      const reader = new FileReader();
      reader.onload = () => {
        setLogoUrl(reader.result as string);
        showToast("Logo ready. Click 'Save Changes' to apply.", "success");
      };
      reader.readAsDataURL(file);
    } finally {
      setLogoUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    showToast("Logo removed. Click 'Save Changes' to apply.", "info");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!activeBusiness) return;
    setSaving(true);
    try {
      const [profile, business] = await Promise.all([
        api<{ user: { id?: number; fullName?: string; email: string; role: "admin" | "staff" | "accountant" } }>("/auth/me", {
          method: "PATCH",
          body: JSON.stringify({ fullName: form.name, email: form.email }),
        }),
        api<{ business: NonNullable<typeof activeBusiness> }>(`/business/${activeBusiness.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: form.business,
            mobileNumber: form.mobileNumber,
            whatsappNumber: form.whatsappNumber,
            address: form.address,
            city: form.city,
            logoUrl: logoUrl || null,
            allowDiscounts,
          }),
        }),
      ]);

      updateUser({
        id: profile.user.id,
        name: profile.user.fullName || form.name,
        email: profile.user.email,
        role: profile.user.role,
      });

      await reloadBusinesses();

      showToast("Store settings and logo updated successfully!", "success");

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

  const resolvedPreview = resolveImageUrl(logoUrl);

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Workspace</label>
          <h1>Settings &amp; Store Branding</h1>
          <p>Update your business logo, contact details, and account preferences.</p>
        </div>
      </div>

      <form className={`${ui.panel} max-w-3xl`} onSubmit={submit}>
        
        {/* Store Logo Section */}
        <div className="mb-6 pb-6 border-b border-slate-200">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
            Store Logo &amp; Branding
          </label>
          <p className="text-xs text-slate-500 mb-4">
            This logo will appear on customer bills, thermal/A4 receipts, and your workspace sidebar.
          </p>

          <div className="flex items-center gap-5">
            {/* Logo Preview Box */}
            <div className="size-20 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
              {resolvedPreview ? (
                <img
                  src={resolvedPreview}
                  alt="Store Logo"
                  className="size-full object-contain p-1"
                />
              ) : (
                <div className="size-full bg-emerald-600 text-white font-black text-2xl flex items-center justify-center">
                  {form.business ? form.business[0]?.toUpperCase() : "A"}
                </div>
              )}
              {logoUploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleLogoFileChange}
                className="hidden"
                id="logo-file-input"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={logoUploading}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition border border-emerald-200 cursor-pointer"
                >
                  {resolvedPreview ? "Change Logo" : "Upload Logo"}
                </button>
                {resolvedPreview && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition border border-rose-200 cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Recommended: Square PNG or JPG with transparent/white background (Max 3MB).
              </p>
            </div>
          </div>
        </div>

        {/* Store & Profile Fields */}
        <div className={ui.formGrid}>
          <div className={ui.field}>
            <label>Business / Store Name</label>
            <input
              className={ui.input}
              required
              value={form.business}
              onChange={(e) => setForm({ ...form, business: e.target.value })}
            />
          </div>

          <div className={ui.field}>
            <label>Store Phone Number (Receipt)</label>
            <input
              className={ui.input}
              placeholder="e.g. 03001234567"
              value={form.mobileNumber}
              onChange={(e) => setForm({ ...form, mobileNumber: e.target.value })}
            />
          </div>

          <div className={ui.field}>
            <label>WhatsApp Number</label>
            <input
              className={ui.input}
              placeholder="e.g. 03152944142"
              value={form.whatsappNumber}
              onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
            />
          </div>

          <div className={ui.field}>
            <label>City</label>
            <input
              className={ui.input}
              placeholder="e.g. Karachi, Lahore, Islamabad"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>

          <div className={`${ui.field} ${ui.span2}`}>
            <label>Store Address (Prints on Invoices)</label>
            <input
              className={ui.input}
              placeholder="e.g. Shop # 4, Main Commercial Market, Malir"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          <div className={ui.field}>
            <label>Account Owner Name</label>
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
        </div>

        {/* POS & Billing Preferences */}
        <div style={{ marginTop: 24, padding: "20px 24px", background: "#f8fafc", borderRadius: 16, border: "1px solid #e2e8f0" }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
            POS Billing & Discount Rules
          </h3>
          <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>
            Control pricing flexibility for cashiers and counter staff.
          </p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
            <input
              type="checkbox"
              checked={allowDiscounts}
              onChange={(e) => setAllowDiscounts(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "#00875a", cursor: "pointer" }}
            />
            <span>Enable Discounts at POS Counter (Allow cashiers to apply Fixed ₨ or Percent % discounts)</span>
          </label>
        </div>

        <div className={ui.formActions}>
          <button className={ui.primary} disabled={saving || logoUploading}>
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </WorkspaceShell>
  );
}
