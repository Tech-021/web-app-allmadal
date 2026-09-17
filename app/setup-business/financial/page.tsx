"use client";

import { useState, useEffect, useMemo, ChangeEvent, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { api } from "@/app/lib/api";

type BankAccount = {
  bankName: string;
  accountNumber: string;
  balance: number;
};

type CustomerItem = {
  name: string;
  mobile: string;
  openingBalance: number;
};

type SupplierItem = {
  name: string;
  mobile: string;
  email: string;
  openingBalance: number;
};

type ProductItem = {
  name: string;
  barcode: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
};

function FinancialSetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { businesses, reloadBusinesses, switchBusiness, setWorkspaceMode } = useBusiness();
  const { showToast } = useToast();

  const businessIdParam = searchParams.get("businessId");
  const targetBusiness = useMemo(() => {
    if (businessIdParam) {
      return businesses.find((b) => String(b.id) === businessIdParam) || null;
    }
    return businesses[0] || null;
  }, [businessIdParam, businesses]);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 5;

  // --- SECTION 4: FINANCIAL STARTING POINT ---
  const [dateOption, setDateOption] = useState<"today" | "month_start" | "custom">("today");
  const [customDate, setCustomDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [openingCash, setOpeningCash] = useState<string>("0");
  const [hasBank, setHasBank] = useState<boolean>(false);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([
    { bankName: "Meezan Bank", accountNumber: "", balance: 0 },
  ]);

  // --- SECTION 5: EXISTING UDHAAR ---
  const [hasCustomerUdhaar, setHasCustomerUdhaar] = useState<boolean>(false);
  const [customerReceivable, setCustomerReceivable] = useState<string>("0");
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [custDraft, setCustDraft] = useState({ name: "", mobile: "", balance: "" });

  const [hasSupplierUdhaar, setHasSupplierUdhaar] = useState<boolean>(false);
  const [supplierPayable, setSupplierPayable] = useState<string>("0");
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [suppDraft, setSuppDraft] = useState({ name: "", mobile: "", email: "", balance: "" });

  // --- SECTION 6: INVENTORY ---
  const [manageStock, setManageStock] = useState<boolean>(true);
  const [currentStockValue, setCurrentStockValue] = useState<string>("0");
  const [wantAddStockNow, setWantAddStockNow] = useState<boolean>(false);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [prodDraft, setProdDraft] = useState({
    name: "",
    barcode: "",
    category: "Mobile Phones",
    costPrice: "0",
    sellingPrice: "",
    stock: "1",
  });

  // --- SECTION 7: TAX INFORMATION ---
  const [taxRegistered, setTaxRegistered] = useState<"yes" | "no" | "not_sure">("no");
  const [ntn, setNtn] = useState<string>("");
  const [strn, setStrn] = useState<string>("");
  const [taxBusinessName, setTaxBusinessName] = useState<string>("");

  // --- SECTION 8: BUSINESS LOGO ---
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [setupComplete, setSetupComplete] = useState<boolean>(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Calculate actual Accounting Start Date based on option
  const effectiveStartDate = useMemo(() => {
    const now = new Date();
    if (dateOption === "today") {
      return now.toISOString().slice(0, 10);
    }
    if (dateOption === "month_start") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return startOfMonth.toISOString().slice(0, 10);
    }
    return customDate;
  }, [dateOption, customDate]);

  // Bank accounts helper
  const addBankAccount = () => {
    setBankAccounts([...bankAccounts, { bankName: "", accountNumber: "", balance: 0 }]);
  };
  const removeBankAccount = (idx: number) => {
    setBankAccounts(bankAccounts.filter((_, i) => i !== idx));
  };
  const updateBankAccount = (idx: number, field: keyof BankAccount, value: string | number) => {
    const updated = [...bankAccounts];
    updated[idx] = { ...updated[idx], [field]: value };
    setBankAccounts(updated);
  };
  const totalBankBalance = useMemo(() => {
    if (!hasBank) return 0;
    return bankAccounts.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0);
  }, [hasBank, bankAccounts]);

  // Customer Udhaar Quick Add
  const handleAddCustomer = (e: FormEvent) => {
    e.preventDefault();
    if (!custDraft.name.trim() || !custDraft.mobile.trim()) {
      showToast("Please provide customer name and mobile.", "info");
      return;
    }
    const bal = Number(custDraft.balance) || 0;
    setCustomers([...customers, { name: custDraft.name.trim(), mobile: custDraft.mobile.trim(), openingBalance: bal }]);
    setCustDraft({ name: "", mobile: "", balance: "" });
    setShowAddCustomerModal(false);
    showToast("Customer added to khata list.", "success");
  };

  // Supplier Udhaar Quick Add
  const handleAddSupplier = (e: FormEvent) => {
    e.preventDefault();
    if (!suppDraft.name.trim()) {
      showToast("Please provide supplier name.", "info");
      return;
    }
    const bal = Number(suppDraft.balance) || 0;
    setSuppliers([
      ...suppliers,
      {
        name: suppDraft.name.trim(),
        mobile: suppDraft.mobile.trim(),
        email: suppDraft.email.trim(),
        openingBalance: bal,
      },
    ]);
    setSuppDraft({ name: "", mobile: "", email: "", balance: "" });
    setShowAddSupplierModal(false);
    showToast("Supplier added to khata list.", "success");
  };

  // Manual Product Quick Add
  const handleAddProduct = (e: FormEvent) => {
    e.preventDefault();
    if (!prodDraft.name.trim() || !prodDraft.sellingPrice) {
      showToast("Product name and selling price are required.", "info");
      return;
    }
    const sPrice = Number(prodDraft.sellingPrice) || 0;
    const cPrice = Number(prodDraft.costPrice) || 0;
    const qty = Math.max(0, parseInt(prodDraft.stock, 10) || 0);

    setProducts([
      ...products,
      {
        name: prodDraft.name.trim(),
        barcode: prodDraft.barcode.trim() || `PRD-${Date.now().toString().slice(-6)}`,
        category: prodDraft.category.trim() || "General",
        costPrice: cPrice,
        sellingPrice: sPrice,
        stock: qty,
        lowStockThreshold: 5,
      },
    ]);
    setProdDraft({
      name: "",
      barcode: "",
      category: "Mobile Phones",
      costPrice: "0",
      sellingPrice: "",
      stock: "1",
    });
    setShowProductModal(false);
    showToast("Product added to stock list.", "success");
  };

  // CSV Import Parser
  const handleCsvImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        showToast("CSV file must contain a header and at least one data row.", "info");
        return;
      }

      const parsed: ProductItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
        if (row.length >= 2 && row[0]) {
          parsed.push({
            name: row[0],
            barcode: row[1] || `CSV-${Date.now().toString().slice(-4)}-${i}`,
            category: row[2] || "Imported",
            costPrice: Number(row[3]) || 0,
            sellingPrice: Number(row[4]) || Number(row[3]) || 0,
            stock: Number(row[5]) || 1,
            lowStockThreshold: 5,
          });
        }
      }

      if (parsed.length > 0) {
        setProducts((prev) => [...prev, ...parsed]);
        showToast(`Successfully imported ${parsed.length} products!`, "success");
      } else {
        showToast("No valid products could be parsed from the file.", "info");
      }
    };
    reader.readAsText(file);
  };

  // Logo Upload & Base64 Handler
  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast("Logo file size must be less than 2MB.", "info");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoUrl(reader.result);
        showToast("Logo uploaded successfully!", "success");
      }
    };
    reader.readAsDataURL(file);
  };

  // Final Submit Handler
  const handleFinalSubmit = async () => {
    const targetId = targetBusiness?.id || (businessIdParam ? Number(businessIdParam) : null);
    if (!targetId) {
      showToast("No active business found to attach financial setup to.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        accountingStartDate: effectiveStartDate,
        openingCashBalance: Number(openingCash) || 0,
        openingBankBalance: totalBankBalance,
        bankAccounts: hasBank ? bankAccounts : [],
        hasCustomerUdhaar,
        customerReceivable: Number(customerReceivable) || 0,
        customers: hasCustomerUdhaar ? customers : [],
        hasSupplierUdhaar,
        supplierPayable: Number(supplierPayable) || 0,
        suppliers: hasSupplierUdhaar ? suppliers : [],
        manageStock,
        currentStockValue: Number(currentStockValue) || 0,
        products: manageStock ? products : [],
        taxRegistered,
        ntn: taxRegistered === "yes" ? ntn : null,
        strn: taxRegistered === "yes" ? strn : null,
        taxBusinessName: taxRegistered === "yes" ? taxBusinessName : null,
        logoUrl: logoUrl || null,
      };

      await api(`/business/${targetId}/financial-setup`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await reloadBusinesses();
      switchBusiness(targetId);
      setWorkspaceMode("financial");
      setSetupComplete(true);
      showToast("Financial setup saved successfully!", "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save financial setup.";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin size-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col justify-between">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="size-9 rounded-xl bg-[#e6f4ed] text-[#00875a] flex items-center justify-center font-black text-lg">
              A
            </span>
            <div>
              <h1 className="text-sm font-extrabold text-slate-900 leading-tight">
                Financial Setup (FPS)
              </h1>
              <p className="text-[11px] font-semibold text-slate-400">
                {targetBusiness?.name || "Your Business Workspace"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">
              Step {currentStep} of {totalSteps}
            </span>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-xs font-bold text-slate-400 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              Skip to Dashboard
            </button>
          </div>
        </div>

        {/* Multi-step progress bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-[#00875a] h-1.5 transition-all duration-300 ease-out"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </header>

      {/* Main Form Content */}
      <main className="max-w-3xl w-full mx-auto px-4 py-8 flex-1">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 sm:p-10">
          
          {/* ================= STEP 1: SECTION 4 FINANCIAL STARTING POINT ================= */}
          {currentStep === 1 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#e6f4ed] text-[#00875a] text-[11px] font-extrabold uppercase tracking-wider mb-2">
                  Section 4
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Financial Starting Point
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Establish your accounting baseline and opening cash balance.
                </p>
              </div>

              {/* 1. Accounting Start Date */}
              <div className="space-y-3">
                <label className="block text-xs font-extrabold text-slate-800">
                  When do you want to start your accounts?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "today", label: "Today", desc: new Date().toLocaleDateString() },
                    {
                      id: "month_start",
                      label: "Start of this month",
                      desc: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString(),
                    },
                    { id: "custom", label: "Custom Date", desc: "Select date" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setDateOption(opt.id as typeof dateOption)}
                      className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                        dateOption === opt.id
                          ? "border-[#00875a] bg-[#e6f4ed]/50 ring-2 ring-[#00875a]/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <strong className="block text-xs font-extrabold text-slate-900">
                        {opt.label}
                      </strong>
                      <span className="text-[11px] font-medium text-slate-500">{opt.desc}</span>
                    </button>
                  ))}
                </div>

                {dateOption === "custom" && (
                  <div className="pt-2 max-w-xs">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Choose Accounting Start Date
                    </label>
                    <input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                    />
                  </div>
                )}
              </div>

              {/* 2. Opening Cash Balance */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <label className="block text-xs font-extrabold text-slate-800">
                  Opening Cash Balance <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <p className="text-[11px] font-medium text-slate-500">
                  How much physical cash do you currently have in your shop drawer or locker?
                </p>
                <div className="relative max-w-sm">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                    ₨
                  </span>
                  <input
                    type="number"
                    min="0"
                    placeholder="500,000"
                    value={openingCash === "0" ? "" : openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-extrabold text-slate-900 outline-none focus:border-[#00875a] transition"
                  />
                </div>
              </div>

              {/* 3. Opening Bank Balance */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800">
                      Do you have business bank accounts?
                    </label>
                    <p className="text-[11px] font-medium text-slate-500">
                      Include current bank balances to track deposits and transfers.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setHasBank(true)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        hasBank ? "bg-[#00875a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasBank(false)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        !hasBank ? "bg-[#00875a] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {hasBank && (
                  <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    {bankAccounts.map((account, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row items-center gap-2">
                        <input
                          type="text"
                          placeholder="Bank Name (e.g. Meezan, HBL)"
                          value={account.bankName}
                          onChange={(e) => updateBankAccount(idx, "bankName", e.target.value)}
                          className="w-full sm:flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                        />
                        <input
                          type="text"
                          placeholder="Account Number (Optional)"
                          value={account.accountNumber}
                          onChange={(e) => updateBankAccount(idx, "accountNumber", e.target.value)}
                          className="w-full sm:flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                        />
                        <div className="relative w-full sm:w-36">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                            ₨
                          </span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Balance"
                            value={account.balance || ""}
                            onChange={(e) => updateBankAccount(idx, "balance", Number(e.target.value))}
                            className="w-full pl-7 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                          />
                        </div>
                        {bankAccounts.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBankAccount(idx)}
                            className="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addBankAccount}
                      className="text-xs font-extrabold text-[#00875a] hover:underline flex items-center gap-1 cursor-pointer pt-1"
                    >
                      + Add another bank account
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 2: SECTION 5 EXISTING UDHAAR ================= */}
          {currentStep === 2 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#e6f4ed] text-[#00875a] text-[11px] font-extrabold uppercase tracking-wider mb-2">
                  Section 5
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Existing Udhaar (Khata)
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Transfer customer receivables and supplier payables to start tracking balances right away.
                </p>
              </div>

              {/* Customer Udhaar (Receivables) */}
              <div className="space-y-4 p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="block text-xs font-extrabold text-slate-900">
                      Do you currently have customers who owe you money?
                    </strong>
                    <span className="text-[11px] font-medium text-slate-500">
                      Customer Khata / Receivables
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setHasCustomerUdhaar(true)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        hasCustomerUdhaar ? "bg-[#00875a] text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasCustomerUdhaar(false)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        !hasCustomerUdhaar ? "bg-[#00875a] text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {hasCustomerUdhaar && (
                  <div className="space-y-4 pt-3 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        Total Amount Customers Owe You
                      </label>
                      <div className="relative max-w-xs">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                          ₨
                        </span>
                        <input
                          type="number"
                          min="0"
                          placeholder="1,250,000"
                          value={customerReceivable === "0" ? "" : customerReceivable}
                          onChange={(e) => setCustomerReceivable(e.target.value)}
                          className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900 outline-none focus:border-[#00875a]"
                        />
                      </div>
                    </div>

                    {/* Customer List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">
                          Individual Customers ({customers.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddCustomerModal(true)}
                          className="text-xs font-extrabold text-[#00875a] hover:underline cursor-pointer"
                        >
                          + Add Customer Now
                        </button>
                      </div>

                      {customers.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {customers.map((c, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold"
                            >
                              <div>
                                <span className="font-extrabold text-slate-900">{c.name}</span>
                                <span className="text-slate-400 text-[11px] ml-2">({c.mobile})</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-extrabold text-[#00875a]">
                                  ₨ {c.openingBalance.toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setCustomers(customers.filter((_, idx) => idx !== i))}
                                  className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] font-medium text-slate-400 italic">
                          You don&apos;t have to enter every customer right now. You can skip and add them anytime.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Supplier Udhaar (Payables) */}
              <div className="space-y-4 p-5 rounded-2xl border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <strong className="block text-xs font-extrabold text-slate-900">
                      Do you owe money to suppliers?
                    </strong>
                    <span className="text-[11px] font-medium text-slate-500">
                      Supplier Khata / Payables
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setHasSupplierUdhaar(true)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        hasSupplierUdhaar ? "bg-[#00875a] text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasSupplierUdhaar(false)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        !hasSupplierUdhaar ? "bg-[#00875a] text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>

                {hasSupplierUdhaar && (
                  <div className="space-y-4 pt-3 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                        Total Amount You Owe Suppliers
                      </label>
                      <div className="relative max-w-xs">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                          ₨
                        </span>
                        <input
                          type="number"
                          min="0"
                          placeholder="850,000"
                          value={supplierPayable === "0" ? "" : supplierPayable}
                          onChange={(e) => setSupplierPayable(e.target.value)}
                          className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-extrabold text-slate-900 outline-none focus:border-[#00875a]"
                        />
                      </div>
                    </div>

                    {/* Supplier List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500">
                          Individual Suppliers ({suppliers.length})
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddSupplierModal(true)}
                          className="text-xs font-extrabold text-[#00875a] hover:underline cursor-pointer"
                        >
                          + Add Supplier Now
                        </button>
                      </div>

                      {suppliers.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {suppliers.map((s, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs font-semibold"
                            >
                              <div>
                                <span className="font-extrabold text-slate-900">{s.name}</span>
                                {s.mobile && <span className="text-slate-400 text-[11px] ml-2">({s.mobile})</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="font-extrabold text-amber-700">
                                  ₨ {s.openingBalance.toLocaleString()}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setSuppliers(suppliers.filter((_, idx) => idx !== i))}
                                  className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] font-medium text-slate-400 italic">
                          You can also add suppliers later as you record purchases.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 3: SECTION 6 INVENTORY ================= */}
          {currentStep === 3 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#e6f4ed] text-[#00875a] text-[11px] font-extrabold uppercase tracking-wider mb-2">
                  Section 6
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Inventory & Stock
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Track your physical items, stock valuation, and import product catalogs.
                </p>
              </div>

              {/* Manage Stock Toggle */}
              <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-200 bg-slate-50">
                <div>
                  <strong className="block text-xs font-extrabold text-slate-900">
                    Do you want to manage your stock in Almadel?
                  </strong>
                  <span className="text-[11px] font-medium text-slate-500">
                    Track barcode, quantities, and low stock warnings
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setManageStock(true)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      manageStock ? "bg-[#00875a] text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setManageStock(false)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                      !manageStock ? "bg-[#00875a] text-white" : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {manageStock && (
                <div className="space-y-6">
                  {/* Current Stock Value */}
                  <div>
                    <label className="block text-xs font-extrabold text-slate-800 mb-1">
                      Estimated Current Stock Value
                    </label>
                    <p className="text-[11px] font-medium text-slate-500 mb-2">
                      Total wholesale/retail value of all items currently on your shelves.
                    </p>
                    <div className="relative max-w-xs">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                        ₨
                      </span>
                      <input
                        type="number"
                        min="0"
                        placeholder="5,500,000"
                        value={currentStockValue === "0" ? "" : currentStockValue}
                        onChange={(e) => setCurrentStockValue(e.target.value)}
                        className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs font-extrabold text-slate-900 outline-none focus:border-[#00875a]"
                      />
                    </div>
                  </div>

                  {/* Add Existing Stock Now Options */}
                  <div className="p-5 rounded-2xl border border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <strong className="block text-xs font-extrabold text-slate-900">
                          Add Existing Stock Items Now
                        </strong>
                        <span className="text-[11px] font-medium text-slate-500">
                          Import products via Excel, CSV or manual entry
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWantAddStockNow(!wantAddStockNow)}
                        className="text-xs font-bold text-[#00875a] hover:underline cursor-pointer"
                      >
                        {wantAddStockNow ? "Hide Importer" : "+ Import Stock"}
                      </button>
                    </div>

                    {wantAddStockNow && (
                      <div className="space-y-4 pt-3 border-t border-slate-100">
                        <div className="flex flex-wrap gap-3">
                          {/* CSV / Excel File Input */}
                          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold cursor-pointer transition">
                            <span>📁 Upload CSV / Excel</span>
                            <input
                              type="file"
                              accept=".csv,.txt"
                              onChange={handleCsvImport}
                              className="hidden"
                            />
                          </label>

                          {/* Manual Add Button */}
                          <button
                            type="button"
                            onClick={() => setShowProductModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#e6f4ed] hover:bg-[#d5eedf] text-[#00875a] text-xs font-extrabold cursor-pointer transition"
                          >
                            <span>+ Manual Item Entry</span>
                          </button>
                        </div>

                        {/* Staged Products Table */}
                        {products.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600">
                              Staged Products ({products.length})
                            </span>
                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                              {products.map((p, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2.5 text-xs bg-white hover:bg-slate-50 transition"
                                >
                                  <div>
                                    <strong className="text-slate-900">{p.name}</strong>
                                    <span className="text-slate-400 text-[10px] ml-2">
                                      Barcode: {p.barcode} • Qty: {p.stock}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-extrabold text-[#00875a]">
                                      ₨ {p.sellingPrice.toLocaleString()}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setProducts(products.filter((_, i) => i !== idx))}
                                      className="text-red-500 hover:text-red-700 font-bold"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 4: SECTION 7 TAX INFORMATION ================= */}
          {currentStep === 4 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#e6f4ed] text-[#00875a] text-[11px] font-extrabold uppercase tracking-wider mb-2">
                  Section 7
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Tax Information
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Optional tax registration details for FBR, NTN, and tax invoice compliance.
                </p>
              </div>

              {/* Tax Registration Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-extrabold text-slate-800">
                  Is your business registered for tax?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: "yes", label: "Yes", desc: "Registered (NTN/STRN)" },
                    { id: "no", label: "No", desc: "Not registered yet" },
                    { id: "not_sure", label: "I'm not sure", desc: "Decide later" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTaxRegistered(opt.id as typeof taxRegistered)}
                      className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
                        taxRegistered === opt.id
                          ? "border-[#00875a] bg-[#e6f4ed]/50 ring-2 ring-[#00875a]/20"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <strong className="block text-xs font-extrabold text-slate-900">
                        {opt.label}
                      </strong>
                      <span className="text-[11px] font-medium text-slate-500">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {taxRegistered === "yes" && (
                <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200 animate-in fade-in">
                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      National Tax Number (NTN)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1234567-8"
                      value={ntn}
                      onChange={(e) => setNtn(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      Sales Tax Registration Number (STRN) <span className="font-normal text-slate-400">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 17-00-1234-567-89"
                      value={strn}
                      onChange={(e) => setStrn(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold text-slate-700 mb-1">
                      Business Registration Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Al-Madina Mobile Center Private Limited"
                      value={taxBusinessName}
                      onChange={(e) => setTaxBusinessName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 5: SECTION 8 BUSINESS LOGO ================= */}
          {currentStep === 5 && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#e6f4ed] text-[#00875a] text-[11px] font-extrabold uppercase tracking-wider mb-2">
                  Section 8
                </span>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  Business Logo & Branding
                </h2>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Upload your brand logo. It will appear on printed and digital receipts.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                {/* Upload Box */}
                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#00875a] bg-slate-50/50 flex flex-col items-center text-center transition">
                  {logoUrl ? (
                    <div className="space-y-3">
                      <div className="size-28 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm mx-auto flex items-center justify-center overflow-hidden">
                        <img src={logoUrl} alt="Business Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                      <button
                        type="button"
                        onClick={() => setLogoUrl("")}
                        className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        Remove Logo
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="size-16 rounded-2xl bg-[#e6f4ed] text-[#00875a] mx-auto flex items-center justify-center text-2xl font-bold">
                        🖼️
                      </div>
                      <div>
                        <strong className="block text-xs font-extrabold text-slate-800">
                          Upload Business Logo
                        </strong>
                        <span className="text-[11px] font-medium text-slate-400">
                          PNG, JPG, or WEBP up to 2MB
                        </span>
                      </div>
                      <label className="inline-block px-4 py-2 rounded-xl bg-[#00875a] hover:bg-[#006b3f] text-white text-xs font-extrabold cursor-pointer transition shadow-md shadow-[#00875a]/20">
                        Choose File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {/* Where will it appear preview card */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                  <strong className="block text-xs font-extrabold text-slate-900">
                    Your logo will appear on:
                  </strong>
                  <ul className="space-y-2 text-xs font-semibold text-slate-600">
                    <li className="flex items-center gap-2">
                      <span className="size-5 rounded-md bg-[#e6f4ed] text-[#00875a] text-[10px] grid place-items-center font-bold">✓</span>
                      Printed Invoices & POS Receipts
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-5 rounded-md bg-[#e6f4ed] text-[#00875a] text-[10px] grid place-items-center font-bold">✓</span>
                      Customer Khata & Ledger Statements
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-5 rounded-md bg-[#e6f4ed] text-[#00875a] text-[10px] grid place-items-center font-bold">✓</span>
                      Automated WhatsApp Invoices
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-5 rounded-md bg-[#e6f4ed] text-[#00875a] text-[10px] grid place-items-center font-bold">✓</span>
                      Exportable Financial Reports
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="pt-8 border-t border-slate-100 flex items-center justify-between gap-3">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                className="px-5 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-extrabold transition cursor-pointer"
              >
                ◀ Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => Math.min(totalSteps, prev + 1))}
                  className="px-6 py-3 rounded-2xl bg-[#00875a] hover:bg-[#006b3f] text-white text-xs font-extrabold shadow-lg shadow-[#00875a]/20 transition cursor-pointer"
                >
                  Save & Next ➔
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleFinalSubmit}
                  className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-extrabold shadow-xl shadow-emerald-700/25 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Completing Setup..." : "Finish & Enter Workspace ➔"}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Quick Add Customer Modal */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddCustomer}
            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4"
          >
            <h3 className="text-base font-extrabold text-slate-900">Add Customer Khata</h3>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Customer Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ali Raza"
                value={custDraft.name}
                onChange={(e) => setCustDraft({ ...custDraft, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile Number *</label>
              <input
                type="tel"
                required
                placeholder="0300-1234567"
                value={custDraft.mobile}
                onChange={(e) => setCustDraft({ ...custDraft, mobile: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Opening Amount Owed (₨)</label>
              <input
                type="number"
                min="0"
                placeholder="25,000"
                value={custDraft.balance}
                onChange={(e) => setCustDraft({ ...custDraft, balance: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00875a] text-white hover:bg-[#006b3f] cursor-pointer"
              >
                Save Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Add Supplier Modal */}
      {showAddSupplierModal && (
        <form
          onSubmit={handleAddSupplier}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Add Supplier Khata</h3>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Supplier / Vendor Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Hafeez Center Wholesale"
                value={suppDraft.name}
                onChange={(e) => setSuppDraft({ ...suppDraft, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile / WhatsApp</label>
              <input
                type="tel"
                placeholder="0321-9876543"
                value={suppDraft.mobile}
                onChange={(e) => setSuppDraft({ ...suppDraft, mobile: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Amount You Owe (₨)</label>
              <input
                type="number"
                min="0"
                placeholder="150,000"
                value={suppDraft.balance}
                onChange={(e) => setSuppDraft({ ...suppDraft, balance: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddSupplierModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00875a] text-white hover:bg-[#006b3f] cursor-pointer"
              >
                Save Supplier
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Manual Product Add Modal */}
      {showProductModal && (
        <form
          onSubmit={handleAddProduct}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">Add Stock Item</h3>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Product Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Redmi Note 13 (8GB/256GB)"
                value={prodDraft.name}
                onChange={(e) => setProdDraft({ ...prodDraft, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Cost Price (₨)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="45,000"
                  value={prodDraft.costPrice}
                  onChange={(e) => setProdDraft({ ...prodDraft, costPrice: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Selling Price (₨) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="52,000"
                  value={prodDraft.sellingPrice}
                  onChange={(e) => setProdDraft({ ...prodDraft, sellingPrice: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Initial Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={prodDraft.stock}
                  onChange={(e) => setProdDraft({ ...prodDraft, stock: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Barcode / IMEI</label>
                <input
                  type="text"
                  placeholder="Optional barcode"
                  value={prodDraft.barcode}
                  onChange={(e) => setProdDraft({ ...prodDraft, barcode: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#00875a]"
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-[#00875a] text-white hover:bg-[#006b3f] cursor-pointer"
              >
                Add Item
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Completion Success Modal */}
      {setupComplete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center space-y-4 animate-in zoom-in-95">
            <div className="size-16 rounded-3xl bg-[#e6f4ed] text-[#00875a] mx-auto flex items-center justify-center text-3xl shadow-md shadow-[#00875a]/10">
              🚀
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">
              Financial Baseline Ready!
            </h3>
            <p className="text-xs font-medium text-slate-500">
              All accounts, udhaar balances, inventory valuation, and brand settings have been synchronized.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="w-full py-4 rounded-2xl bg-[#00875a] hover:bg-[#006b3f] text-white text-xs font-extrabold shadow-lg shadow-[#00875a]/25 transition cursor-pointer"
              >
                Go to POS & Store Dashboard ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs font-medium text-slate-400 py-4">
        © {new Date().getFullYear()} Almadel Management Platform. All data is securely encrypted.
      </footer>
    </div>
  );
}

export default function FinancialSetupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="animate-spin size-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <FinancialSetupContent />
    </Suspense>
  );
}
