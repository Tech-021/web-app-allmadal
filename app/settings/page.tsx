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
import { useLanguage } from "@/app/components/language-context";
import { useTheme } from "@/app/components/theme-context";
import { useNavRole } from "@/hooks/useNavRole";
import st from "./settings.module.css";

type Snapshot = { form: Record<string, string>; logoUrl: string; allowDiscounts: boolean };

const FIELD_LABELS: Record<string, string> = {
  name: "owner name",
  email: "email",
  business: "store name",
  mobileNumber: "store phone",
  whatsappNumber: "WhatsApp",
  address: "address",
  city: "city",
};

const SECTIONS = [
  { id: "workspace", label: "Workspace & region" },
  { id: "logo", label: "Store logo" },
  { id: "store", label: "Store details" },
  { id: "owner", label: "Owner account" },
  { id: "counter", label: "Counter rules" },
] as const;

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const { activeBusiness, reloadBusinesses, workspaceMode, setWorkspaceMode } = useBusiness();
  const { showToast } = useToast();
  const { language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const navRole = useNavRole();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
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
    const next = {
      name: user?.name || "",
      email: user?.email || "",
      business: activeBusiness?.name || "",
      mobileNumber: activeBusiness?.mobileNumber || "",
      whatsappNumber: activeBusiness?.whatsappNumber || "",
      address: activeBusiness?.address || "",
      city: activeBusiness?.city || "",
    };
    setForm(next);
    setLogoUrl(activeBusiness?.logoUrl || "");
    setAllowDiscounts(activeBusiness?.allowDiscounts ?? true);
    setSnapshot({ form: next, logoUrl: activeBusiness?.logoUrl || "", allowDiscounts: activeBusiness?.allowDiscounts ?? true });
    setFieldErrors({});
  }, [user?.name, user?.email, activeBusiness]);

  // Highlight the section in view in the sub-nav.
  useEffect(() => {
    const els = SECTIONS.map((x) => document.getElementById(`settings-${x.id}`)).filter((x): x is HTMLElement => Boolean(x));
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiveSection(visible.target.id.replace("settings-", ""));
      },
      { rootMargin: "-20% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const changes = snapshot
    ? [
        ...Object.keys(FIELD_LABELS).filter((k) => (form as Record<string, string>)[k] !== snapshot.form[k]).map((k) => FIELD_LABELS[k]),
        ...(logoUrl !== snapshot.logoUrl ? ["logo"] : []),
        ...(allowDiscounts !== snapshot.allowDiscounts ? ["discounts"] : []),
      ]
    : [];
  const dirty = changes.length > 0;

  const discard = () => {
    if (!snapshot) return;
    setForm(snapshot.form as typeof form);
    setLogoUrl(snapshot.logoUrl);
    setAllowDiscounts(snapshot.allowDiscounts);
    setFieldErrors({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
      showToast("Logo uploaded", "success", { description: "Save changes to put it on your receipts." });
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
    showToast("Logo removed", "info", { description: "Save changes to apply." });
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

      showToast("Settings saved", "success", { description: "New receipts use these details right away." });

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

  const sectionHead = (id: string, title: string, body: string) => (
    <div className={ui.sectionAside}>
      <h2 id={`settings-${id}-title`}>{title}</h2>
      <p>{body}</p>
    </div>
  );

  return (
    <WorkspaceShell>
      <PageHeader title="Settings" />

      <div className={st.layout}>
        <nav className={st.subnav} aria-label="Settings sections">
          {SECTIONS.map((x) => (
            <a
              key={x.id}
              href={`#settings-${x.id}`}
              className={activeSection === x.id ? st.subnavOn : undefined}
              aria-current={activeSection === x.id ? "true" : undefined}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`settings-${x.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveSection(x.id);
              }}
            >
              {x.label}
            </a>
          ))}
        </nav>

        <form onSubmit={submit} noValidate className={`${ui.sectionList} ${st.form}`}>
          <section className={ui.section} id="settings-workspace" aria-labelledby="settings-workspace-title">
            {sectionHead("workspace", "Workspace & region", "How Almadel works at your counter, and how it looks. These apply instantly on this device.")}
            <div className={`${ui.sectionBody} ${st.stack}`}>
              {navRole === "admin" && activeBusiness && (
                <div role="radiogroup" aria-label="Workspace mode" className={st.modes}>
                  {(
                    [
                      ["pos", "POS", "Fast counter selling, products and stock. Cash and online only."],
                      ["financial", "Financial", "Everything in POS, plus khata, cash books, expenses, closing and reports."],
                    ] as const
                  ).map(([id, label, body]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={workspaceMode === id}
                      className={`${st.mode} ${workspaceMode === id ? st.modeOn : ""}`}
                      onClick={() => setWorkspaceMode(id)}
                    >
                      <span className={st.modeHead}>
                        <b>{label}</b>
                        <span className={st.radio} aria-hidden />
                      </span>
                      <span className={st.modeBody}>{body}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className={st.prefRow}>
                <div>
                  <b>Language</b>
                  <span>Menus and receipts. Product names stay as you typed them.</span>
                </div>
                <div className={ui.segmented} role="radiogroup" aria-label="Language">
                  {(
                    [
                      ["en", "English"],
                      ["ur", "Roman Urdu"],
                    ] as const
                  ).map(([id, label]) => (
                    <button key={id} type="button" role="radio" aria-checked={language === id} className={language === id ? ui.segmentedOn : ""} onClick={() => setLanguage(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={st.prefRow}>
                <div>
                  <b>Appearance</b>
                  <span>Porcelain by day, Graphite at night — or follow this device.</span>
                </div>
                <div className={ui.segmented} role="radiogroup" aria-label="Theme">
                  {(
                    [
                      ["light", "Light", "sun"],
                      ["dark", "Dark", "moon"],
                      ["system", "System", "panel"],
                    ] as const
                  ).map(([id, label, icon]) => (
                    <button key={id} type="button" role="radio" aria-checked={theme === id} className={theme === id ? ui.segmentedOn : ""} onClick={() => setTheme(id)}>
                      <Icon name={icon} size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
        {/* Branding */}
        <section className={ui.section} id="settings-logo" aria-labelledby="settings-logo-title">
          {sectionHead("logo", "Store logo", "Appears on customer bills, thermal / A4 receipts and in your workspace sidebar.")}
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
        <section className={ui.section} id="settings-store" aria-labelledby="settings-store-title">
          {sectionHead("store", "Store details", "Printed on invoices so customers know where to find and reach you.")}
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
        <section className={ui.section} id="settings-owner" aria-labelledby="settings-owner-title">
          {sectionHead("owner", "Owner account", "The name and email used to sign in and receive account notices.")}
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
        <section className={ui.section} id="settings-counter" aria-labelledby="settings-counter-title">
          {sectionHead("counter", "Counter rules", "Control how much pricing flexibility cashiers have at the POS.")}
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

        <div className={`${st.saveBar} ${dirty || saving ? st.saveBarOn : ""}`} role="region" aria-label="Unsaved changes" aria-hidden={!dirty && !saving}>
          <span className={st.saveDot} aria-hidden />
          <span className={st.saveText} aria-live="polite">
            {saving ? "Saving changes…" : `${changes.length} unsaved ${changes.length === 1 ? "change" : "changes"} · ${changes.slice(0, 3).join(", ")}${changes.length > 3 ? "…" : ""}`}
          </span>
          <button type="button" className={st.discard} onClick={discard} disabled={saving} tabIndex={dirty ? 0 : -1}>
            Discard
          </button>
          <button type="submit" className={st.save} disabled={saving || logoUploading} tabIndex={dirty || saving ? 0 : -1}>
            {saving ? <span className={st.spin} aria-hidden /> : null}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      </div>
    </WorkspaceShell>
  );
}
