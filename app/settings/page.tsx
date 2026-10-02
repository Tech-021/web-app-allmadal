"use client";

import { FormEvent, useEffect, useState, useRef, useCallback } from "react";
import { useBusiness } from "@/app/components/business-context";
import { useAuth } from "@/hooks/useAuth";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, resolveImageUrl, uploadProductImage } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { logActivity } from "@/app/lib/logger";
import {
  sanitizePhoneInput,
  validateEmail,
  validateLogoImageFile,
  validatePhone,
  validateStoredLogoUrl,
  validateText,
} from "@/app/lib/validators";
import ui from "@/app/components/workspace-ui.module.css";
import { PageHeader } from "@/app/components/page-layout";
import { Icon } from "@/app/components/icons";

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { activeBusiness, reloadBusinesses } = useBusiness();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [allowDiscounts, setAllowDiscounts] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
    setAllowDiscounts(activeBusiness?.allowDiscounts ?? true);
    setFieldErrors({});
  }, [user?.name, user?.email, activeBusiness]);

  const validateAll = useCallback(() => {
    const errors: Record<string, string> = {};

    const businessErr = validateText(form.business, { min: 2, max: 100, fieldLabel: "Business name" }).error;
    if (businessErr) errors.business = businessErr;

    const nameErr = validateText(form.name, { min: 2, max: 100, fieldLabel: "Account owner name" }).error;
    if (nameErr) errors.name = nameErr;

    const emailErr = validateEmail(form.email, { required: true, fieldName: "Email address" }).error;
    if (emailErr) errors.email = emailErr;

    const mobileErr = validatePhone(form.mobileNumber, {
      required: false,
      fieldName: "Store phone number",
    }).error;
    if (mobileErr) errors.mobileNumber = mobileErr;

    const whatsappErr = validatePhone(form.whatsappNumber, {
      required: false,
      fieldName: "WhatsApp number",
    }).error;
    if (whatsappErr) errors.whatsappNumber = whatsappErr;

    const addressErr = validateText(form.address, {
      max: 200,
      required: false,
      fieldLabel: "Store address",
    }).error;
    if (addressErr) errors.address = addressErr;

    const cityErr = validateText(form.city, {
      min: 1,
      max: 60,
      required: false,
      fieldLabel: "City",
    }).error;
    if (cityErr) errors.city = cityErr;

    const logoErr = validateStoredLogoUrl(logoUrl).error;
    if (logoErr) errors.logo = logoErr;

    setFieldErrors(errors);
    return errors;
  }, [form, logoUrl]);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileCheck = validateLogoImageFile(file);
    if (!fileCheck.valid) {
      showToast(fileCheck.error || "Invalid logo file.", "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLogoUploading(true);
    try {
      const res = await uploadProductImage(file);
      setLogoUrl(res.url);
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.logo;
        return next;
      });
      showToast("Logo uploaded. Click 'Save Changes' to apply.", "success");
    } catch (err) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      const msg = err instanceof Error ? err.message : "Could not upload logo.";
      showToast(`${msg} Logo was not saved — try again or check your connection.`, "error");
    } finally {
      setLogoUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.logo;
      return next;
    });
    showToast("Logo removed. Click 'Save Changes' to apply.", "info");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!activeBusiness) return;

    const errors = validateAll();
    if (Object.keys(errors).length > 0) {
      showToast(Object.values(errors)[0] || "Please correct the highlighted fields.", "error");
      return;
    }

    setSaving(true);
    try {
      const trimmedBusiness = form.business.trim();
      const trimmedMobile = form.mobileNumber.trim();
      const trimmedWhatsapp = form.whatsappNumber.trim();

      const [profile, business] = await Promise.all([
        api<{ user: { id?: number; fullName?: string; email: string; role: "admin" | "staff" | "accountant" } }>("/auth/me", {
          method: "PATCH",
          body: JSON.stringify({ fullName: form.name.trim(), email: form.email.trim() }),
        }),
        api<{ business: NonNullable<typeof activeBusiness> }>(`/business/${activeBusiness.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: trimmedBusiness,
            mobileNumber: trimmedMobile || null,
            whatsappNumber: trimmedWhatsapp || null,
            address: form.address.trim() || null,
            city: form.city.trim() || null,
            logoUrl: logoUrl.trim() || null,
            allowDiscounts,
          }),
        }),
      ]);

      updateUser({
        id: profile.user.id,
        name: profile.user.fullName || form.name.trim(),
        email: profile.user.email,
      });

      await reloadBusinesses();

      showToast("Store settings and logo updated successfully!", "success");

      logActivity(
        "SETTINGS_UPDATE",
        "Settings",
        `Updated account & store settings for '${business.business.name}'`,
        business.business.name,
        { name: form.name.trim(), email: form.email.trim(), business: business.business.name }
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not update settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  const resolvedPreview = resolveImageUrl(logoUrl);

  const err = (key: string) =>
    fieldErrors[key] ? (
      <span className={ui.fieldError}>
        <Icon name="alert" size={12} />
        {fieldErrors[key]}
      </span>
    ) : null;
  const inv = (key: string) => (fieldErrors[key] ? ui.invalid : "");

  return (
    <WorkspaceShell>
      <PageHeader eyebrow="Workspace" title="Settings" description="Your store branding, contact details and counter preferences." />

      <form onSubmit={submit} noValidate className={ui.sectionList}>
        {/* Branding */}
        <section className={ui.section}>
          <div className={ui.sectionAside}>
            <h2>Store logo</h2>
            <p>Appears on customer bills, thermal / A4 receipts and in your workspace sidebar.</p>
          </div>
          <div className={ui.sectionBody}>
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] shadow-[var(--shadow-xs)]">
                {resolvedPreview ? (
                  <img src={resolvedPreview} alt="Store logo" className="size-full object-contain p-1.5" />
                ) : (
                  <span className="text-[26px] font-semibold text-[var(--brand)]">{form.business ? form.business[0]?.toUpperCase() : "A"}</span>
                )}
                {logoUploading && (
                  <div className="absolute inset-0 grid place-items-center bg-[var(--glass)]">
                    <span className="size-5 rounded-full border-2 border-[var(--brand)] border-t-transparent [animation:almadelSpin_700ms_linear_infinite]" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleLogoFileChange}
                  className="hidden"
                  id="logo-file-input"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={logoUploading} className={ui.secondary}>
                    <Icon name="upload" size={14} />
                    {resolvedPreview ? "Change logo" : "Upload logo"}
                  </button>
                  {resolvedPreview && (
                    <button type="button" onClick={removeLogo} className={`${ui.iconButton} hover:!text-[var(--neg)]`} aria-label="Remove logo" title="Remove logo">
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>
                <span className="text-[12px] text-[var(--muted)]">Square PNG or JPG, transparent or white background · max 3MB</span>
                {err("logo")}
              </div>
            </div>
          </div>
        </section>

        {/* Store details */}
        <section className={ui.section}>
          <div className={ui.sectionAside}>
            <h2>Store details</h2>
            <p>Printed on invoices so customers know where to find and reach you.</p>
          </div>
          <div className={`${ui.sectionBody} ${ui.formGrid}`}>
            <div className={`${ui.field} ${ui.span2}`}>
              <label htmlFor="st-business">Business / store name</label>
              <input id="st-business" className={`${ui.input} ${inv("business")}`} required maxLength={100} value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} />
              {err("business")}
            </div>
            <div className={ui.field}>
              <label htmlFor="st-phone">Store phone (on receipt)</label>
              <input
                id="st-phone"
                className={`${ui.input} ${ui.inputMono} ${inv("mobileNumber")}`}
                type="tel"
                maxLength={16}
                placeholder="03001234567"
                value={form.mobileNumber}
                onChange={(e) => setForm({ ...form, mobileNumber: sanitizePhoneInput(e.target.value) })}
              />
              {err("mobileNumber")}
            </div>
            <div className={ui.field}>
              <label htmlFor="st-wa">WhatsApp number</label>
              <input
                id="st-wa"
                className={`${ui.input} ${ui.inputMono} ${inv("whatsappNumber")}`}
                type="tel"
                maxLength={16}
                placeholder="03152944142"
                value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: sanitizePhoneInput(e.target.value) })}
              />
              {err("whatsappNumber")}
            </div>
            <div className={ui.field}>
              <label htmlFor="st-city">City</label>
              <input id="st-city" className={`${ui.input} ${inv("city")}`} maxLength={60} placeholder="Karachi, Lahore, Islamabad…" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              {err("city")}
            </div>
            <div className={ui.field}>
              <label htmlFor="st-address">Store address</label>
              <input
                id="st-address"
                className={`${ui.input} ${inv("address")}`}
                maxLength={200}
                placeholder="Shop # 4, Main Commercial Market"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              {err("address")}
            </div>
          </div>
        </section>

        {/* Owner account */}
        <section className={ui.section}>
          <div className={ui.sectionAside}>
            <h2>Owner account</h2>
            <p>The name and email used to sign in and receive account notices.</p>
          </div>
          <div className={`${ui.sectionBody} ${ui.formGrid}`}>
            <div className={ui.field}>
              <label htmlFor="st-name">Full name</label>
              <input id="st-name" className={`${ui.input} ${inv("name")}`} required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              {err("name")}
            </div>
            <div className={ui.field}>
              <label htmlFor="st-email">Email address</label>
              <input id="st-email" className={`${ui.input} ${inv("email")}`} required type="email" maxLength={100} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {err("email")}
            </div>
          </div>
        </section>

        {/* POS rules */}
        <section className={ui.section}>
          <div className={ui.sectionAside}>
            <h2>Counter rules</h2>
            <p>Control how much pricing flexibility cashiers have at the POS.</p>
          </div>
          <div className={ui.sectionBody}>
            <label className={ui.switchRow}>
              <span>
                <strong>Allow discounts at the counter</strong>
                <small>Cashiers can apply fixed (Rs) or percentage (%) discounts to a bill.</small>
              </span>
              <input type="checkbox" role="switch" className={ui.switch} checked={allowDiscounts} onChange={(e) => setAllowDiscounts(e.target.checked)} />
            </label>
          </div>
        </section>

        <div className={ui.sectionFooter}>
          <p>Changes apply to new receipts immediately.</p>
          <button className={ui.primary} disabled={saving || logoUploading}>
            {saving ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-current border-t-transparent [animation:almadelSpin_700ms_linear_infinite]" />
                Saving…
              </>
            ) : (
              <>
                <Icon name="check" size={15} />
                Save changes
              </>
            )}
          </button>
        </div>
      </form>
    </WorkspaceShell>
  );
}
