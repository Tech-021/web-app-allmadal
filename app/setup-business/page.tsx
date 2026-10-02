"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { api } from "@/app/lib/api";
import { logActivity } from "@/app/lib/logger";
import { validatePhone, validateEmail, validateText, sanitizePhoneInput } from "@/app/lib/validators";
import { Icon, type IconName } from "@/app/components/icons";
import { FieldError, OnboardingFrame, StepHead, UserChip } from "@/app/components/onboarding-frame";
import ob from "@/app/components/onboarding.module.css";
import ui from "@/app/components/workspace-ui.module.css";

const BUSINESS_TYPES = [
  "Mobile Shop",
  "Electronics Shop",
  "General Store / Kiryana",
  "Clothing",
  "Pharmacy",
  "Restaurant / Food",
  "Wholesale",
  "Retail",
  "Services",
  "Other",
] as const;

const BUSINESS_TYPE_ICONS: Record<(typeof BUSINESS_TYPES)[number], IconName> = {
  "Mobile Shop": "phone",
  "Electronics Shop": "zap",
  "General Store / Kiryana": "store",
  Clothing: "tag",
  Pharmacy: "shield",
  "Restaurant / Food": "receipt",
  Wholesale: "truck",
  Retail: "cart",
  Services: "settings",
  Other: "dots",
};

const ONBOARDING_STEPS = [
  { title: "Business details", hint: "Name, type and contact" },
  { title: "Choose workspace", hint: "POS or Financial books" },
  { title: "Activate free trial", hint: "30 days · secure Stripe checkout" },
];

const WORKSPACE_OPTIONS: Array<{ mode: "pos" | "financial"; icon: IconName; title: string; body: string; points: string[] }> = [
  {
    mode: "pos",
    icon: "cart",
    title: "POS workspace",
    body: "Start selling right away from the counter.",
    points: ["Products, sales & inventory", "Barcode scanning & receipts", "Staff counters"],
  },
  {
    mode: "financial",
    icon: "wallet",
    title: "Financial Starting Point (FPS)",
    body: "Bring your existing books in first.",
    points: ["Opening cash & bank balances", "Customer & supplier udhaar", "Inventory value & taxes"],
  },
];

const MOBILE_CATEGORIES = [
  "Mobile Retail",
  "Mobile Wholesale",
  "Mobile + Accessories",
  "Used Mobile Phones",
  "Mobile Repair",
  "Mobile + Repair",
  "Mobile Distributor",
  "Other",
] as const;

const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
] as const;

export default function SetupBusinessPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { reloadBusinesses, switchBusiness, setWorkspaceMode, activeBusiness, businesses, isLoading: bizLoading } = useBusiness();
  const { showToast } = useToast();

  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<string>("Mobile Shop");
  const [businessCategory, setBusinessCategory] = useState<string>("Mobile + Accessories");

  const [mobileNumber, setMobileNumber] = useState("");
  const [sameAsMobile, setSameAsMobile] = useState(true);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [email, setEmail] = useState("");

  const [showAddress, setShowAddress] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [province, setProvince] = useState<string>("Punjab");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [activatingStripe, setActivatingStripe] = useState(false);
  const [pendingActivation, setPendingActivation] = useState<{ name: string; workspaceMode: "pos" | "financial" } | null>(null);
  // Sync flag: blocks the "already has business → dashboard" redirect while the choice modal is in play.
  // Must be a ref because reloadBusinesses() updates business state before React commits showSuccessModal.
  const holdForModeChoiceRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
      return;
    }
    // Keep the POS vs Financial / Stripe choice visible after setup — do not auto-redirect away.
    if (showSuccessModal || showStripeModal || holdForModeChoiceRef.current) {
      return;
    }
    // 1-Admin = 1-Business Rule: Redirect to dashboard if user already owns or belongs to a business
    if (!bizLoading && (activeBusiness || (businesses && businesses.length > 0))) {
      router.replace("/dashboard");
    }
  }, [authLoading, isAuthenticated, activeBusiness, businesses, bizLoading, router, showSuccessModal, showStripeModal]);

  // Resume onboarding if user saved a draft but has not finished Stripe yet
  useEffect(() => {
    if (!isAuthenticated || authLoading || bizLoading || activeBusiness) return;
    if (showSuccessModal || showStripeModal) return;

    void (async () => {
      try {
        const status = await api<{
          hasDraft?: boolean;
          hasBusiness?: boolean;
          draft?: { businessName?: string; workspaceMode?: "pos" | "financial" };
        }>("/business/onboarding/status");

        if (status.hasBusiness || !status.hasDraft || !status.draft?.businessName) return;

        holdForModeChoiceRef.current = true;
        setBusinessName(status.draft.businessName);
        setPendingActivation({
          name: status.draft.businessName,
          workspaceMode: status.draft.workspaceMode === "financial" ? "financial" : "pos",
        });
        setShowSuccessModal(true);
      } catch {
        /* ignore */
      }
    })();
  }, [isAuthenticated, authLoading, bizLoading, activeBusiness, showSuccessModal, showStripeModal]);

  const applyWorkspaceMode = (mode: "pos" | "financial") => {
    setWorkspaceMode(mode);
  };

  const handleActivateStripeTrial = async () => {
    try {
      setActivatingStripe(true);
      const successUrl = `${window.location.origin}/dashboard?payment=success`;
      const cancelUrl = `${window.location.origin}/setup-business?payment=canceled`;

      const response = await api<{ success: boolean; url: string }>("/billing/onboarding-checkout", {
        method: "POST",
        body: JSON.stringify({ successUrl, cancelUrl }),
      });

      if (response.url) {
        logActivity(
          "STRIPE_TRIAL_CHECKOUT_INITIATED",
          "Billing",
          `Initiated Stripe 30-day trial to activate store '${pendingActivation?.name || businessName}'`,
          pendingActivation?.name || businessName,
          { workspaceMode: pendingActivation?.workspaceMode || "pos" }
        );
        window.location.href = response.url;
        return;
      }

      showToast("Unable to open Stripe checkout.", "error");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start Stripe checkout.";
      showToast(msg, "error");
    } finally {
      setActivatingStripe(false);
    }
  };

  // Validation functions using validators.ts
  const validateBusinessName = (name: string): string => {
    return validateText(name, { min: 2, max: 100, fieldLabel: "Business name" }).error || "";
  };

  const validateMobile = (mobile: string): string => {
    return validatePhone(mobile, { required: true, fieldName: "Primary mobile number" }).error || "";
  };

  const validateWhatsapp = (whatsapp: string, same: boolean, mobile: string): string => {
    if (same) {
      return validateMobile(mobile);
    }
    return validatePhone(whatsapp, { required: false, fieldName: "WhatsApp number" }).error || "";
  };

  const validateEmailField = (val: string): string => {
    return validateEmail(val, { required: false, fieldName: "Business email" }).error || "";
  };

  const validateAddress = (val: string): string => {
    return validateText(val, { max: 200, required: false, fieldLabel: "Street address" }).error || "";
  };

  const validateAll = () => {
    const errors: Record<string, string> = {};

    const nameErr = validateBusinessName(businessName);
    if (nameErr) errors.businessName = nameErr;

    const mobileErr = validateMobile(mobileNumber);
    if (mobileErr) errors.mobileNumber = mobileErr;

    const whatsappErr = validateWhatsapp(whatsappNumber, sameAsMobile, mobileNumber);
    if (whatsappErr) errors.whatsappNumber = whatsappErr;

    const emailErr = validateEmailField(email);
    if (emailErr) errors.email = emailErr;

    if (showAddress) {
      const addrErr = validateAddress(address);
      if (addrErr) errors.address = addrErr;
    }

    setFieldErrors(errors);
    return errors;
  };

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === "businessName") {
      setFieldErrors((prev) => ({ ...prev, businessName: validateBusinessName(businessName) }));
    } else if (field === "mobileNumber") {
      setFieldErrors((prev) => ({ ...prev, mobileNumber: validateMobile(mobileNumber) }));
    } else if (field === "whatsappNumber") {
      setFieldErrors((prev) => ({
        ...prev,
        whatsappNumber: validateWhatsapp(whatsappNumber, sameAsMobile, mobileNumber),
      }));
    } else if (field === "email") {
      setFieldErrors((prev) => ({ ...prev, email: validateEmailField(email) }));
    }
  };

  const handleMobileChange = (val: string) => {
    const sanitized = sanitizePhoneInput(val);
    setMobileNumber(sanitized);
    const err = validateMobile(sanitized);
    setFieldErrors((prev) => ({ ...prev, mobileNumber: err }));
    if (sameAsMobile) {
      setWhatsappNumber(sanitized);
      setFieldErrors((prev) => ({ ...prev, whatsappNumber: err }));
    }
  };

  const handleWhatsappChange = (val: string) => {
    const sanitized = sanitizePhoneInput(val);
    setWhatsappNumber(sanitized);
    const err = validateWhatsapp(sanitized, false, mobileNumber);
    setFieldErrors((prev) => ({ ...prev, whatsappNumber: err }));
  };

  const handleSameAsMobileToggle = (checked: boolean) => {
    setSameAsMobile(checked);
    if (checked) {
      setWhatsappNumber(mobileNumber);
      setFieldErrors((prev) => ({ ...prev, whatsappNumber: validateMobile(mobileNumber) }));
    } else {
      setFieldErrors((prev) => ({ ...prev, whatsappNumber: validateWhatsapp(whatsappNumber, false, mobileNumber) }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError("");

    setTouched({
      businessName: true,
      mobileNumber: true,
      whatsappNumber: true,
      email: true,
      address: true,
    });

    const errors = validateAll();
    if (Object.keys(errors).length > 0) {
      const firstErrorMessage = Object.values(errors)[0];
      setGeneralError(firstErrorMessage || "Please correct the highlighted fields before submitting.");
      showToast("Please check the form for invalid inputs.", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await api<{
        success: boolean;
        requiresStripe?: boolean;
        draft?: { businessName: string; workspaceMode: "pos" | "financial" };
      }>("/business/setup", {
        method: "POST",
        body: JSON.stringify({
          name: businessName.trim(),
          businessType,
          businessCategory: businessType === "Mobile Shop" ? businessCategory : null,
          mobileNumber: mobileNumber.trim(),
          whatsappNumber: sameAsMobile ? mobileNumber.trim() : (whatsappNumber.trim() || null),
          email: email.trim() || null,
          address: showAddress && address.trim() ? address.trim() : null,
          city: showAddress && city.trim() ? city.trim() : null,
          area: showAddress && area.trim() ? area.trim() : null,
          province: showAddress ? province : null,
          accountingStartDate: new Date().toISOString(),
          openingCashBalance: 0,
        }),
      });

      showToast("Business details saved. Activate your 30-day trial with Stripe to go live.", "success");

      logActivity(
        "PAGE_VISIT",
        "Visit",
        `Owner saved onboarding draft for '${businessName}'`,
        "/setup-business"
      );

      holdForModeChoiceRef.current = true;
      setPendingActivation({
        name: res.draft?.businessName || businessName.trim(),
        workspaceMode: res.draft?.workspaceMode === "financial" ? "financial" : "pos",
      });
      setShowSuccessModal(true);

      if (typeof window !== "undefined") {
        localStorage.removeItem("almadel_workspace_mode");
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to set up business. Please check your details.";
      setGeneralError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = showStripeModal ? 3 : showSuccessModal ? 2 : 1;
  const activationName = pendingActivation?.name || businessName;

  const chooseWorkspace = async (mode: "pos" | "financial") => {
    applyWorkspaceMode(mode);
    try {
      await api("/business/onboarding/workspace-mode", {
        method: "PATCH",
        body: JSON.stringify({ workspaceMode: mode }),
      });
    } catch {
      /* draft already saved */
    }
    setPendingActivation((p) => (p ? { ...p, workspaceMode: mode } : p));
    setShowSuccessModal(false);
    setShowStripeModal(true);
  };

  const invalid = (field: string, visible: boolean) => (visible && fieldErrors[field] ? ob.invalid : "");

  return (
    <OnboardingFrame
      context={stepIndex > 1 ? activationName : "Business setup"}
      railEyebrow="Fast onboarding · about a minute"
      railTitle="Set up your business"
      railText="Three short steps and your store is ready to sell."
      steps={ONBOARDING_STEPS}
      current={stepIndex}
      topRight={user ? <UserChip name={user.name} /> : null}
    >
      {stepIndex === 1 && (
        <form onSubmit={handleSubmit} noValidate>
          <StepHead
            step={1}
            total={ONBOARDING_STEPS.length}
            title="Tell us about your business"
            description="Your business name and contact details appear on receipts and invoices. You can change them later anytime."
          />

          {generalError && (
            <div className="mb-6">
              <div className={ui.error} role="alert">
                <Icon name="alert" size={15} className="mt-px shrink-0" />
                <span>{generalError}</span>
              </div>
            </div>
          )}

          <div className={ob.stepBody}>
            {/* Business information */}
            <div className={ob.block}>
              <div className={ob.blockHead}>
                <div className={ob.blockTitle}>
                  <span className={ob.num}>1</span>
                  <div>
                    <h2>Business information</h2>
                    <p>What you sell decides the defaults we prepare for you.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <div className={ob.field}>
                  <div className={ob.labelRow}>
                    <label className={ob.label} htmlFor="ob-name">
                      Business name<em>*</em>
                    </label>
                    <span className={ob.counter}>{businessName.length}/100</span>
                  </div>
                  <input
                    id="ob-name"
                    type="text"
                    required
                    maxLength={100}
                    value={businessName}
                    onBlur={() => markTouched("businessName")}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      if (touched.businessName) {
                        const err = validateBusinessName(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, businessName: err }));
                      }
                    }}
                    placeholder="e.g. Al-Madina Mobile Center"
                    aria-invalid={Boolean(touched.businessName && fieldErrors.businessName)}
                    className={`${ui.input} ${invalid("businessName", Boolean(touched.businessName))}`}
                  />
                  <FieldError>{touched.businessName ? fieldErrors.businessName : ""}</FieldError>
                </div>

                <div className={ob.field}>
                  <span className={ob.label} id="ob-type-label">
                    Business type<em>*</em>
                  </span>
                  <div className={`${ob.choices} ${ob.choicesTypes}`} role="radiogroup" aria-labelledby="ob-type-label">
                    {BUSINESS_TYPES.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={businessType === t}
                        onClick={() => setBusinessType(t)}
                        className={`${ob.choice} ${ob.choiceCompact} ${businessType === t ? ob.choiceOn : ""}`}
                      >
                        <Icon name={BUSINESS_TYPE_ICONS[t]} size={17} />
                        <strong>{t}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                {businessType === "Mobile Shop" && (
                  <div className={`${ob.field} al-pop`}>
                    <label className={ob.label} htmlFor="ob-category">
                      Business category
                    </label>
                    <select
                      id="ob-category"
                      value={businessCategory}
                      onChange={(e) => setBusinessCategory(e.target.value)}
                      className={`${ui.select} sm:max-w-[320px]`}
                    >
                      {MOBILE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Contact information */}
            <div className={ob.block}>
              <div className={ob.blockHead}>
                <div className={ob.blockTitle}>
                  <span className={ob.num}>2</span>
                  <div>
                    <h2>Contact information</h2>
                    <p>Printed on receipts so customers can reach you.</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-5">
                <div className={ob.grid2}>
                  <div className={ob.field}>
                    <label className={ob.label} htmlFor="ob-mobile">
                      Mobile number<em>*</em>
                    </label>
                    <input
                      id="ob-mobile"
                      type="tel"
                      required
                      maxLength={15}
                      value={mobileNumber}
                      onBlur={() => markTouched("mobileNumber")}
                      onChange={(e) => handleMobileChange(e.target.value)}
                      placeholder="0300-1234567"
                      aria-invalid={Boolean((touched.mobileNumber || mobileNumber) && fieldErrors.mobileNumber)}
                      className={`${ui.input} ${invalid("mobileNumber", Boolean(touched.mobileNumber || mobileNumber))}`}
                    />
                    <FieldError>{touched.mobileNumber || mobileNumber ? fieldErrors.mobileNumber : ""}</FieldError>
                  </div>

                  <div className={ob.field}>
                    <div className={ob.labelRow}>
                      <label className={ob.label} htmlFor="ob-whatsapp">
                        WhatsApp number
                      </label>
                      <label className="flex cursor-pointer select-none items-center gap-1.5 text-[12px] text-[var(--muted)]">
                        <input
                          type="checkbox"
                          checked={sameAsMobile}
                          onChange={(e) => handleSameAsMobileToggle(e.target.checked)}
                          className="size-3.5 min-h-0 accent-[var(--brand)]"
                        />
                        Same as mobile
                      </label>
                    </div>
                    <input
                      id="ob-whatsapp"
                      type="tel"
                      disabled={sameAsMobile}
                      maxLength={15}
                      value={sameAsMobile ? mobileNumber : whatsappNumber}
                      onBlur={() => markTouched("whatsappNumber")}
                      onChange={(e) => handleWhatsappChange(e.target.value)}
                      placeholder="0300-1234567"
                      className={`${ui.input} disabled:bg-[var(--surface-2)] disabled:text-[var(--muted)] ${
                        !sameAsMobile ? invalid("whatsappNumber", Boolean(touched.whatsappNumber || whatsappNumber)) : ""
                      }`}
                    />
                    <FieldError>
                      {!sameAsMobile && (touched.whatsappNumber || whatsappNumber) ? fieldErrors.whatsappNumber : ""}
                    </FieldError>
                  </div>
                </div>

                <div className={ob.field}>
                  <label className={ob.label} htmlFor="ob-email">
                    Business email<i>Optional</i>
                  </label>
                  <input
                    id="ob-email"
                    type="email"
                    value={email}
                    onBlur={() => markTouched("email")}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (touched.email) {
                        const err = validateEmailField(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, email: err }));
                      }
                    }}
                    placeholder="shop@almadina.com"
                    className={`${ui.input} ${invalid("email", Boolean(touched.email))}`}
                  />
                  <FieldError>{touched.email ? fieldErrors.email : ""}</FieldError>
                </div>

                <div>
                  <button type="button" onClick={() => setShowAddress(!showAddress)} className={ob.linkAction} aria-expanded={showAddress}>
                    <Icon name={showAddress ? "minus" : "plus"} size={14} />
                    {showAddress ? "Remove business address" : "Add business address (optional)"}
                  </button>

                  {showAddress && (
                    <div className={ob.inset}>
                      <div className={ob.field}>
                        <label className={ob.label} htmlFor="ob-address">
                          Street / market address
                        </label>
                        <input
                          id="ob-address"
                          type="text"
                          maxLength={200}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Shop #12, Hafeez Center, Main Boulevard"
                          className={ui.input}
                        />
                        <FieldError>{touched.address ? fieldErrors.address : ""}</FieldError>
                      </div>
                      <div className={ob.grid3}>
                        <div className={ob.field}>
                          <label className={ob.label} htmlFor="ob-city">
                            City
                          </label>
                          <input id="ob-city" type="text" maxLength={60} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lahore" className={ui.input} />
                        </div>
                        <div className={ob.field}>
                          <label className={ob.label} htmlFor="ob-area">
                            Area / town
                          </label>
                          <input id="ob-area" type="text" maxLength={60} value={area} onChange={(e) => setArea(e.target.value)} placeholder="Gulberg III" className={ui.input} />
                        </div>
                        <div className={ob.field}>
                          <label className={ob.label} htmlFor="ob-province">
                            Province / territory
                          </label>
                          <select id="ob-province" value={province} onChange={(e) => setProvince(e.target.value)} className={ui.select}>
                            {PROVINCES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={ob.nav}>
            <span className="hidden text-[12.5px] text-[var(--muted)] sm:block">
              <span className="text-[var(--neg)]">*</span> Required
            </span>
            <button type="submit" disabled={saving} className={`${ui.primary} ${ob.navCta}`}>
              {saving ? (
                <>
                  <span className="size-3.5 rounded-full border-2 border-current border-t-transparent [animation:almadelSpin_700ms_linear_infinite]" />
                  Creating your workspace…
                </>
              ) : (
                <>
                  Continue
                  <Icon name="arrowRight" size={15} />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {stepIndex === 2 && (
        <div>
          <StepHead
            step={2}
            total={ONBOARDING_STEPS.length}
            title="Choose your workspace"
            description={
              <>
                <strong className="font-medium text-[var(--text)]">{activationName}</strong> is saved. Pick how you want to start — you can
                switch workspaces later.
              </>
            }
          />
          <div className={`${ob.choices} ${ob.choices2}`}>
            {WORKSPACE_OPTIONS.map((w) => (
              <button
                key={w.mode}
                type="button"
                onClick={() => void chooseWorkspace(w.mode)}
                className={`${ob.choice} ${ob.workspaceChoice} ${pendingActivation?.workspaceMode === w.mode ? ob.choiceOn : ""}`}
              >
                <Icon name={w.icon} size={20} />
                <strong>{w.title}</strong>
                <span>{w.body}</span>
                <ul>
                  {w.points.map((pt) => (
                    <li key={pt}>
                      <Icon name="check" size={13} strokeWidth={2} />
                      {pt}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
            <Icon name="info" size={14} />
            Selecting a workspace takes you to trial activation.
          </p>
        </div>
      )}

      {stepIndex === 3 && (
        <div className={ob.center}>
          <span className={ob.seal}>
            <Icon name="sparkle" size={24} />
          </span>
          <span className={ob.badge}>
            <Icon name="clock" size={13} />
            30-day free trial ready
          </span>
          <h1 className="mb-1.5 mt-4 text-[clamp(22px,2.6vw,28px)] font-semibold tracking-[-0.03em]">
            {pendingActivation?.workspaceMode === "financial" ? "Financial workspace selected" : "POS workspace selected"}
          </h1>
          <p className="m-0 max-w-[52ch] text-[13.5px] leading-relaxed text-[var(--muted)]">
            Activate <strong className="font-medium text-[var(--text)]">{activationName}</strong> with Stripe to start your 30-day free
            trial.
            {pendingActivation?.workspaceMode === "financial"
              ? " You will continue to Financial Starting Point (FPS) right after checkout."
              : " You will land in POS right after checkout."}
          </p>

          <dl className={ob.summary}>
            <div>
              <dt>Business</dt>
              <dd>{activationName}</dd>
            </div>
            <div>
              <dt>Workspace</dt>
              <dd>{pendingActivation?.workspaceMode === "financial" ? "Financial (FPS)" : "POS"}</dd>
            </div>
            <div>
              <dt>Trial</dt>
              <dd>30 days free · cancel anytime</dd>
            </div>
          </dl>

          <div className="mt-4 flex w-full flex-col gap-2.5 sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => void handleActivateStripeTrial()}
              disabled={activatingStripe}
              className={`${ui.primary} ${ob.navCta} sm:flex-1`}
            >
              {activatingStripe ? (
                <>
                  <span className="size-3.5 rounded-full border-2 border-current border-t-transparent [animation:almadelSpin_700ms_linear_infinite]" />
                  Opening secure checkout…
                </>
              ) : (
                <>
                  <Icon name="card" size={16} />
                  Activate 30-day trial with Stripe
                </>
              )}
            </button>
            <button
              type="button"
              disabled={activatingStripe}
              onClick={() => {
                setShowStripeModal(false);
                holdForModeChoiceRef.current = false;
                setShowSuccessModal(true);
              }}
              className={`${ui.secondary} ${ob.navCta}`}
            >
              <Icon name="left" size={15} />
              Change workspace
            </button>
          </div>

          <span className={ob.secure}>
            <Icon name="lock" size={13} />
            Secure checkout powered by Stripe
          </span>
        </div>
      )}
    </OnboardingFrame>
  );
}
