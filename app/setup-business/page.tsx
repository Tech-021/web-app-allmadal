"use client";

import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { api } from "@/app/lib/api";
import { logActivity } from "@/app/lib/logger";

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
  const { reloadBusinesses, switchBusiness } = useBusiness();
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
  const [createdBusiness, setCreatedBusiness] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Validation functions
  const validateBusinessName = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return "Business name is required.";
    if (trimmed.length < 2) return "Business name must be at least 2 characters long.";
    if (trimmed.length > 100) return "Business name cannot exceed 100 characters.";
    return "";
  };

  const validateMobile = (mobile: string): string => {
    const trimmed = mobile.trim();
    if (!trimmed) return "Primary mobile number is required.";
    const digits = trimmed.replace(/[^0-9]/g, "");
    if (digits.length < 10 || digits.length > 15) {
      return "Please enter a valid mobile number (e.g., 0300-1234567 or 03XXXXXXXXX).";
    }
    return "";
  };

  const validateWhatsapp = (whatsapp: string, same: boolean, mobile: string): string => {
    if (same) {
      return validateMobile(mobile);
    }
    const trimmed = whatsapp.trim();
    if (!trimmed) return "";
    const digits = trimmed.replace(/[^0-9]/g, "");
    if (digits.length < 10 || digits.length > 15) {
      return "Please enter a valid WhatsApp number (min 10 digits).";
    }
    return "";
  };

  const validateEmail = (val: string): string => {
    const trimmed = val.trim();
    if (!trimmed) return "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return "Please enter a valid email address (e.g., shop@example.com).";
    }
    return "";
  };

  const validateAddress = (val: string): string => {
    if (val.trim().length > 200) {
      return "Street address cannot exceed 200 characters.";
    }
    return "";
  };

  const validateAll = () => {
    const errors: Record<string, string> = {};

    const nameErr = validateBusinessName(businessName);
    if (nameErr) errors.businessName = nameErr;

    const mobileErr = validateMobile(mobileNumber);
    if (mobileErr) errors.mobileNumber = mobileErr;

    const whatsappErr = validateWhatsapp(whatsappNumber, sameAsMobile, mobileNumber);
    if (whatsappErr) errors.whatsappNumber = whatsappErr;

    const emailErr = validateEmail(email);
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
      const err = validateBusinessName(businessName);
      setFieldErrors((prev) => ({ ...prev, businessName: err }));
    } else if (field === "mobileNumber") {
      const err = validateMobile(mobileNumber);
      setFieldErrors((prev) => ({ ...prev, mobileNumber: err }));
    } else if (field === "whatsappNumber") {
      const err = validateWhatsapp(whatsappNumber, sameAsMobile, mobileNumber);
      setFieldErrors((prev) => ({ ...prev, whatsappNumber: err }));
    } else if (field === "email") {
      const err = validateEmail(email);
      setFieldErrors((prev) => ({ ...prev, email: err }));
    }
  };

  const handleMobileChange = (val: string) => {
    setMobileNumber(val);
    if (sameAsMobile) {
      setWhatsappNumber(val);
    }
    if (touched.mobileNumber) {
      const err = validateMobile(val);
      setFieldErrors((prev) => ({ ...prev, mobileNumber: err }));
    }
  };

  const handleSameAsMobileToggle = (checked: boolean) => {
    setSameAsMobile(checked);
    if (checked) {
      setWhatsappNumber(mobileNumber);
      if (touched.whatsappNumber) {
        setFieldErrors((prev) => ({ ...prev, whatsappNumber: "" }));
      }
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
      const res = await api<{ success: boolean; business: { id: number; name: string } }>("/business/setup", {
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

      showToast(`Business '${businessName}' created successfully!`, "success");

      logActivity(
        "PAGE_VISIT",
        "Visit",
        `Owner completed business setup for '${businessName}'`,
        "/setup-business",
        { businessId: res.business.id }
      );

      await reloadBusinesses();
      if (res.business?.id) {
        switchBusiness(res.business.id);
      }

      setCreatedBusiness(res.business);
      setShowSuccessModal(true);
    } catch (err: any) {
      const msg = err?.message || "Failed to set up business. Please check your details.";
      setGeneralError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col justify-between p-4 sm:p-8">
      {/* Header Bar */}
      <header className="max-w-3xl mx-auto w-full flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <div className="size-10 rounded-2xl bg-[#00875a] text-white font-extrabold grid place-items-center shadow-lg shadow-[#00875a]/20">
            A
          </div>
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-gray-900 leading-none">Almadel</h2>
            <p className="text-[11px] font-bold text-gray-400 mt-0.5">Store Management Platform</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm text-xs font-bold text-gray-700">
            <span className="size-2 rounded-full bg-green-500 animate-pulse" />
            <span>{user.name}</span>
          </div>
        )}
      </header>

      {/* Main Onboarding Card */}
      <main className="max-w-2xl mx-auto w-full my-6">
        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xl border border-gray-100">
          <div className="border-b border-gray-100 pb-6 mb-8">
            <span className="inline-block px-3 py-1 rounded-full bg-[#e6f4ed] text-[#006b3f] text-[11px] font-extrabold uppercase tracking-wider mb-2">
              Fast 1-Minute Onboarding
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
              Set Up Your Business
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1">
              Tell us a little about your business. You can change these details later anytime.
            </p>
          </div>

          {generalError && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>{generalError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-8">
            {/* Section 1: Business Information */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="size-6 rounded-full bg-gray-900 text-white text-xs font-extrabold grid place-items-center">
                  1
                </span>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900">
                  Business Information
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-700">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <span className="text-[11px] text-gray-400">
                      {businessName.length}/100
                    </span>
                  </div>
                  <input
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
                    className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold text-gray-900 placeholder:text-gray-400 outline-none transition ${
                      touched.businessName && fieldErrors.businessName
                        ? "border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                        : "border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10"
                    }`}
                  />
                  {touched.businessName && fieldErrors.businessName && (
                    <p className="mt-1.5 text-xs font-bold text-red-600 flex items-center gap-1.5 animate-in fade-in">
                      <span>•</span>
                      <span>{fieldErrors.businessName}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Business Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 text-sm font-bold text-gray-900 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10 outline-none transition cursor-pointer"
                    >
                      {BUSINESS_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {businessType === "Mobile Shop" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">
                        Business Category
                      </label>
                      <select
                        value={businessCategory}
                        onChange={(e) => setBusinessCategory(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 text-sm font-bold text-gray-900 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10 outline-none transition cursor-pointer"
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
            </div>

            {/* Section 2: Contact Information */}
            <div className="pt-6 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <span className="size-6 rounded-full bg-gray-900 text-white text-xs font-extrabold grid place-items-center">
                  2
                </span>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900">
                  Contact Information
                </h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      Mobile Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={mobileNumber}
                      onBlur={() => markTouched("mobileNumber")}
                      onChange={(e) => handleMobileChange(e.target.value)}
                      placeholder="0300-1234567"
                      className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold text-gray-900 placeholder:text-gray-400 outline-none transition ${
                        touched.mobileNumber && fieldErrors.mobileNumber
                          ? "border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                          : "border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10"
                      }`}
                    />
                    {touched.mobileNumber && fieldErrors.mobileNumber && (
                      <p className="mt-1.5 text-xs font-bold text-red-600 flex items-center gap-1.5 animate-in fade-in">
                        <span>•</span>
                        <span>{fieldErrors.mobileNumber}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-gray-700">
                        WhatsApp Number
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#00875a] cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={sameAsMobile}
                          onChange={(e) => handleSameAsMobileToggle(e.target.checked)}
                          className="rounded accent-[#00875a]"
                        />
                        <span>Same as mobile</span>
                      </label>
                    </div>
                    <input
                      type="tel"
                      disabled={sameAsMobile}
                      value={sameAsMobile ? mobileNumber : whatsappNumber}
                      onBlur={() => markTouched("whatsappNumber")}
                      onChange={(e) => {
                        setWhatsappNumber(e.target.value);
                        if (touched.whatsappNumber) {
                          const err = validateWhatsapp(e.target.value, false, mobileNumber);
                          setFieldErrors((prev) => ({ ...prev, whatsappNumber: err }));
                        }
                      }}
                      placeholder="0300-1234567"
                      className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold text-gray-900 placeholder:text-gray-400 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed ${
                        !sameAsMobile && touched.whatsappNumber && fieldErrors.whatsappNumber
                          ? "border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                          : "border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10"
                      }`}
                    />
                    {!sameAsMobile && touched.whatsappNumber && fieldErrors.whatsappNumber && (
                      <p className="mt-1.5 text-xs font-bold text-red-600 flex items-center gap-1.5 animate-in fade-in">
                        <span>•</span>
                        <span>{fieldErrors.whatsappNumber}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Business Email <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onBlur={() => markTouched("email")}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (touched.email) {
                        const err = validateEmail(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, email: err }));
                      }
                    }}
                    placeholder="shop@almadina.com"
                    className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold text-gray-900 placeholder:text-gray-400 outline-none transition ${
                      touched.email && fieldErrors.email
                        ? "border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                        : "border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10"
                    }`}
                  />
                  {touched.email && fieldErrors.email && (
                    <p className="mt-1.5 text-xs font-bold text-red-600 flex items-center gap-1.5 animate-in fade-in">
                      <span>•</span>
                      <span>{fieldErrors.email}</span>
                    </p>
                  )}
                </div>

                {/* Optional Address Toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowAddress(!showAddress)}
                    className="text-xs font-bold text-[#00875a] hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{showAddress ? "▲ Hide Business Address" : "+ Add Business Address (Optional)"}</span>
                  </button>

                  {showAddress && (
                    <div className="mt-3 p-4 rounded-2xl bg-gray-50/80 border border-gray-200 space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-600 mb-1">
                          Street / Market Address
                        </label>
                        <input
                          type="text"
                          maxLength={200}
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Shop #12, Hafeez Center, Main Boulevard"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-900 outline-none focus:border-[#00875a]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            City
                          </label>
                          <input
                            type="text"
                            maxLength={60}
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Lahore"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-900 outline-none focus:border-[#00875a]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Area / Town
                          </label>
                          <input
                            type="text"
                            maxLength={60}
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                            placeholder="Gulberg III"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-900 outline-none focus:border-[#00875a]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-600 mb-1">
                            Province / Territory
                          </label>
                          <select
                            value={province}
                            onChange={(e) => setProvince(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-900 outline-none focus:border-[#00875a]"
                          >
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

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-100">
              <button
                type="submit"
                disabled={saving}
                className="w-full h-14 rounded-full bg-[#00875a] hover:bg-[#006b3f] active:scale-[0.99] text-white font-extrabold text-sm shadow-xl shadow-[#00875a]/25 transition flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <span>Creating Your Business Workspace...</span>
                ) : (
                  <span>Complete Setup & Continue ➔</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Post-Setup Choice Modal (POS vs Financial Static) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in-95 duration-200">
            {/* Celebration Icon */}
            <div className="size-16 rounded-3xl bg-[#e6f4ed] text-[#00875a] mx-auto flex items-center justify-center text-3xl mb-4 shadow-md shadow-[#00875a]/10">
              🎉
            </div>

            <span className="inline-block px-3 py-1 rounded-full bg-[#e6f4ed] text-[#006b3f] text-[11px] font-extrabold uppercase tracking-wider mb-2">
              Setup Completed
            </span>

            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900">
              {createdBusiness?.name || businessName}
            </h2>
            <p className="text-xs font-semibold text-gray-500 mt-1.5 mb-6">
              Your business workspace is live and ready. Select where you would like to proceed:
            </p>

            <div className="space-y-3">
              {/* POS Navigation Button */}
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full py-4 px-6 rounded-2xl bg-[#00875a] hover:bg-[#006b3f] active:scale-[0.98] text-white font-extrabold text-sm shadow-lg shadow-[#00875a]/25 transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="size-8 rounded-xl bg-white/20 grid place-items-center text-base">
                    🛒
                  </span>
                  <div className="text-left">
                    <p className="leading-tight font-extrabold text-sm">POS Workspace</p>
                    <p className="text-[11px] font-medium text-white/80">Manage products, sales & inventory</p>
                  </div>
                </div>
                <span className="text-base font-bold">➔</span>
              </button>

              {/* Financial Starting Point (FPS) Navigation Button */}
              <button
                type="button"
                onClick={() => {
                  const bId = createdBusiness?.id;
                  router.push(bId ? `/setup-business/financial?businessId=${bId}` : "/setup-business/financial");
                }}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-[0.98] text-white font-extrabold text-sm shadow-lg shadow-emerald-700/20 transition flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="size-8 rounded-xl bg-white/20 grid place-items-center text-base">
                    📊
                  </span>
                  <div className="text-left">
                    <p className="leading-tight font-extrabold text-sm text-white">Financial Starting Point (FPS)</p>
                    <p className="text-[11px] font-medium text-emerald-100">Setup cash, udhaar, inventory & taxes</p>
                  </div>
                </div>
                <span className="text-base font-bold text-white">➔</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs font-medium text-gray-400 py-4">
        © {new Date().getFullYear()} Almadel Management Platform. All data is securely encrypted.
      </footer>
    </div>
  );
}
