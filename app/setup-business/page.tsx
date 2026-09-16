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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdBusiness, setCreatedBusiness] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleMobileChange = (val: string) => {
    setMobileNumber(val);
    if (sameAsMobile) {
      setWhatsappNumber(val);
    }
  };

  const handleSameAsMobileToggle = (checked: boolean) => {
    setSameAsMobile(checked);
    if (checked) {
      setWhatsappNumber(mobileNumber);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!businessName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (!mobileNumber.trim()) {
      setError("Please enter your primary business mobile number.");
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
          address: address.trim() || null,
          city: city.trim() || null,
          area: area.trim() || null,
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
      setError(msg);
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

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
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
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Al-Madina Mobile Center"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10 outline-none transition"
                  />
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
                      onChange={(e) => handleMobileChange(e.target.value)}
                      placeholder="03XX-XXXXXXX"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10 outline-none transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-gray-700">
                        WhatsApp Number
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-bold text-[#00875a] cursor-pointer">
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
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="03XX-XXXXXXX"
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10 outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Business Email <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="shop@almadina.com"
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-gray-50/50 text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-[#00875a] focus:ring-4 focus:ring-[#00875a]/10 outline-none transition"
                  />
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

              {/* Financial Static Button (Placeholder / Remains as is) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                }}
                className="w-full py-4 px-6 rounded-2xl bg-gray-50 hover:bg-gray-100/80 border border-gray-200 text-gray-700 font-extrabold text-sm transition flex items-center justify-between cursor-default"
              >
                <div className="flex items-center gap-3">
                  <span className="size-8 rounded-xl bg-gray-200/80 grid place-items-center text-base text-gray-600">
                    📊
                  </span>
                  <div className="text-left">
                    <p className="leading-tight font-extrabold text-sm text-gray-800">Financial Static</p>
                    <p className="text-[11px] font-medium text-gray-400">Reports, ledger & accounts</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-extrabold bg-gray-200 text-gray-600 px-2 py-1 rounded-lg">
                  Static
                </span>
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

