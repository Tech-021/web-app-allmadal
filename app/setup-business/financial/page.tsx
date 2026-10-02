"use client";

import { useState, useEffect, useMemo, ChangeEvent, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { api } from "@/app/lib/api";
import { logActivity } from "@/app/lib/logger";
import { validatePhone, validateEmail, validateText, validateNumber, sanitizePhoneInput, formatCurrencyInput, parseCurrencyInput } from "@/app/lib/validators";
import { Icon, type IconName } from "@/app/components/icons";
import { FieldError, LoadingScreen, OnboardingFrame, StepHead, YesNo } from "@/app/components/onboarding-frame";
import ob from "@/app/components/onboarding.module.css";
import ui from "@/app/components/workspace-ui.module.css";

const FPS_STEPS = [
  { title: "Starting point", hint: "Start date, cash & banks" },
  { title: "Supplier udhaar", hint: "What you owe" },
  { title: "Customer udhaar", hint: "What you're owed" },
  { title: "Inventory", hint: "Stock value & items" },
  { title: "Tax information", hint: "NTN / STRN" },
  { title: "Logo & branding", hint: "Receipts & reports" },
];

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
  const totalSteps = 6;

  // Validation errors state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

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
  const [custModalError, setCustModalError] = useState("");

  const [hasSupplierUdhaar, setHasSupplierUdhaar] = useState<boolean>(false);
  const [supplierPayable, setSupplierPayable] = useState<string>("0");
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [showAddSupplierModal, setShowAddSupplierModal] = useState<boolean>(false);
  const [suppDraft, setSuppDraft] = useState({ name: "", mobile: "", email: "", balance: "" });
  const [suppModalError, setSuppModalError] = useState("");

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
  const [prodModalError, setProdModalError] = useState("");

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

  // Step-Level Validation Guard
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (dateOption === "custom") {
        if (!customDate || isNaN(new Date(customDate).getTime())) {
          newErrors.customDate = "Please select a valid accounting start date.";
        }
      }
      const cash = Number(openingCash);
      if (isNaN(cash) || cash < 0) {
        newErrors.openingCash = "Cash balance must be a non-negative number.";
      }
      if (hasBank) {
        bankAccounts.forEach((acc, idx) => {
          if (!acc.bankName.trim()) {
            newErrors[`bankName_${idx}`] = "Bank name is required.";
          }
          if (isNaN(Number(acc.balance)) || Number(acc.balance) < 0) {
            newErrors[`bankBal_${idx}`] = "Balance must be 0 or greater.";
          }
        });
      }
    }

    if (step === 2) {
      // Step 2: Supplier Udhaar (Payables)
      if (hasSupplierUdhaar) {
        const suppPay = Number(supplierPayable);
        if (isNaN(suppPay) || suppPay < 0) {
          newErrors.supplierPayable = "Supplier payable amount must be 0 or greater.";
        }
      }
    }

    if (step === 3) {
      // Step 3: Customer Udhaar (Receivables)
      if (hasCustomerUdhaar) {
        const custRec = Number(customerReceivable);
        if (isNaN(custRec) || custRec < 0) {
          newErrors.customerReceivable = "Customer receivable amount must be 0 or greater.";
        }
      }
    }

    if (step === 4) {
      // Step 4: Inventory
      if (manageStock) {
        const stockVal = Number(currentStockValue);
        if (isNaN(stockVal) || stockVal < 0) {
          newErrors.currentStockValue = "Stock value must be 0 or greater.";
        }
      }
    }

    if (step === 5) {
      // Step 5: Tax
      if (taxRegistered === "yes") {
        const cleanNtn = ntn.trim();
        if (!cleanNtn) {
          newErrors.ntn = "National Tax Number (NTN) is required for tax-registered businesses.";
        } else if (cleanNtn.length < 5) {
          newErrors.ntn = "Please enter a valid NTN (e.g., 1234567-8).";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
    } else {
      showToast("Please review and fix highlighted fields before continuing.", "info");
    }
  };

  // Customer Udhaar Quick Add with Validation
  const handleAddCustomer = (e: FormEvent) => {
    e.preventDefault();
    setCustModalError("");
    const nameVal = validateText(custDraft.name, { minLength: 2, maxLength: 60, fieldName: "Customer name" });
    if (!nameVal.valid) {
      setCustModalError(nameVal.error || "Customer name must be at least 2 characters.");
      return;
    }
    const phoneVal = validatePhone(custDraft.mobile, { required: true, fieldName: "Mobile number" });
    if (!phoneVal.valid) {
      setCustModalError(phoneVal.error || "Please enter a valid mobile number (10-15 digits).");
      return;
    }
    const balVal = validateNumber(custDraft.balance || "0", { min: 0, fieldName: "Opening balance" });
    if (!balVal.valid) {
      setCustModalError(balVal.error || "Amount owed must be 0 or greater.");
      return;
    }

    setCustomers([...customers, { name: custDraft.name.trim(), mobile: custDraft.mobile.trim(), openingBalance: Number(custDraft.balance) || 0 }]);
    setCustDraft({ name: "", mobile: "", balance: "" });
    setShowAddCustomerModal(false);
    showToast("Customer added to khata list.", "success");
  };

  // Supplier Udhaar Quick Add with Validation
  const handleAddSupplier = (e: FormEvent) => {
    e.preventDefault();
    setSuppModalError("");
    const nameVal = validateText(suppDraft.name, { minLength: 2, maxLength: 60, fieldName: "Supplier name" });
    if (!nameVal.valid) {
      setSuppModalError(nameVal.error || "Supplier name must be at least 2 characters.");
      return;
    }
    const phoneVal = validatePhone(suppDraft.mobile, { required: true, fieldName: "Supplier mobile / WhatsApp" });
    if (!phoneVal.valid) {
      setSuppModalError(phoneVal.error || "Please enter a valid mobile number (10-15 digits).");
      return;
    }
    if (suppDraft.email.trim()) {
      const emailVal = validateEmail(suppDraft.email, { required: false });
      if (!emailVal.valid) {
        setSuppModalError(emailVal.error || "Please enter a valid email address.");
        return;
      }
    }
    const balVal = validateNumber(suppDraft.balance || "0", { min: 0, fieldName: "Opening balance" });
    if (!balVal.valid) {
      setSuppModalError(balVal.error || "Amount owed must be 0 or greater.");
      return;
    }

    setSuppliers([
      ...suppliers,
      {
        name: suppDraft.name.trim(),
        mobile: suppDraft.mobile.trim(),
        email: suppDraft.email.trim(),
        openingBalance: Number(suppDraft.balance) || 0,
      },
    ]);
    setSuppDraft({ name: "", mobile: "", email: "", balance: "" });
    setShowAddSupplierModal(false);
    showToast("Supplier added to khata list.", "success");
  };

  // Manual Product Quick Add with Validation
  const handleAddProduct = (e: FormEvent) => {
    e.preventDefault();
    setProdModalError("");
    const name = prodDraft.name.trim();
    const sPrice = Number(prodDraft.sellingPrice);
    const cPrice = Number(prodDraft.costPrice);
    const qty = parseInt(prodDraft.stock, 10);

    if (!name || name.length < 2) {
      setProdModalError("Product name must be at least 2 characters.");
      return;
    }
    if (isNaN(sPrice) || sPrice <= 0) {
      setProdModalError("Selling price must be greater than 0.");
      return;
    }
    if (isNaN(cPrice) || cPrice < 0) {
      setProdModalError("Cost price must be 0 or greater.");
      return;
    }
    if (isNaN(qty) || qty < 0) {
      setProdModalError("Stock quantity must be 0 or greater.");
      return;
    }

    setProducts([
      ...products,
      {
        name,
        barcode: prodDraft.barcode.trim() || `PRD-${Date.now().toString().slice(-6)}`,
        category: prodDraft.category.trim() || "General",
        costPrice: cPrice || 0,
        sellingPrice: sPrice,
        stock: qty || 0,
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
          const sPrice = Number(row[4]) || Number(row[3]) || 0;
          if (row[0].length >= 1 && sPrice >= 0) {
            parsed.push({
              name: row[0],
              barcode: row[1] || `CSV-${Date.now().toString().slice(-4)}-${i}`,
              category: row[2] || "Imported",
              costPrice: Math.max(0, Number(row[3]) || 0),
              sellingPrice: Math.max(0, sPrice),
              stock: Math.max(0, Number(row[5]) || 1),
              lowStockThreshold: 5,
            });
          }
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

  // Logo Upload & Size Validation
  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      showToast("Please select a valid image file (PNG, JPG, WEBP).", "info");
      return;
    }

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
    if (!validateStep(6) || !validateStep(5) || !validateStep(4) || !validateStep(3) || !validateStep(2) || !validateStep(1)) {
      showToast("Please check previous steps for missing or invalid details.", "info");
      return;
    }

    const targetId = targetBusiness?.id || (businessIdParam ? Number(businessIdParam) : null);
    if (!targetId) {
      showToast("No active business found to attach financial setup to.", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        accountingStartDate: effectiveStartDate,
        openingCashBalance: Math.max(0, Number(openingCash) || 0),
        openingBankBalance: Math.max(0, totalBankBalance),
        bankAccounts: hasBank ? bankAccounts : [],
        hasCustomerUdhaar,
        customerReceivable: Math.max(0, Number(customerReceivable) || 0),
        customers: hasCustomerUdhaar ? customers : [],
        hasSupplierUdhaar,
        supplierPayable: Math.max(0, Number(supplierPayable) || 0),
        suppliers: hasSupplierUdhaar ? suppliers : [],
        manageStock,
        currentStockValue: Math.max(0, Number(currentStockValue) || 0),
        products: manageStock ? products : [],
        taxRegistered,
        ntn: taxRegistered === "yes" ? ntn.trim() : null,
        strn: taxRegistered === "yes" ? strn.trim() : null,
        taxBusinessName: taxRegistered === "yes" ? taxBusinessName.trim() : null,
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

      logActivity(
        "FINANCIAL_SETUP_COMPLETE",
        "Finance",
        `Completed 6-step Financial Setup for '${targetBusiness?.name || `Store #${targetId}`}'`,
        targetBusiness?.name || `Store #${targetId}`,
        { targetId, openingCash, totalBankBalance, hasCustomerUdhaar, hasSupplierUdhaar }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save financial setup.";
      showToast(msg, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [activatingStripe, setActivatingStripe] = useState<boolean>(false);

  const handleActivateStripeTrial = async () => {
    const targetId = targetBusiness?.id || (businessIdParam ? Number(businessIdParam) : null);
    if (!targetId) {
      router.push("/dashboard");
      return;
    }

    try {
      setActivatingStripe(true);
      const successUrl = `${window.location.origin}/dashboard?payment=success`;
      const cancelUrl = `${window.location.origin}/dashboard?payment=trial_started`;

      const response = await api<{ success: boolean; url: string }>(
        "/billing/create-checkout-session",
        {
          method: "POST",
          body: JSON.stringify({
            businessId: targetId,
            successUrl,
            cancelUrl,
          }),
        }
      );

      if (response.url) {
        logActivity(
          "STRIPE_TRIAL_CHECKOUT_INITIATED",
          "Billing",
          `Initiated Stripe 30-day trial subscription for store '${targetBusiness?.name || `#${targetId}`}'`,
          targetBusiness?.name || `Store #${targetId}`,
          { targetId }
        );
        window.location.href = response.url;
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      console.error("Stripe trial checkout error:", err);
      showToast(err.message || "Redirecting to dashboard...", "info");
      router.push("/dashboard");
    } finally {
      setActivatingStripe(false);
    }
  };

  if (authLoading) {
    return <LoadingScreen label="Preparing financial setup…" />;
  }

  const moneyInput = (
    id: string,
    value: string,
    onValue: (raw: string) => void,
    placeholder: string,
    errorKey?: string,
  ) => (
    <div className={ob.money}>
      <span>Rs</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={formatCurrencyInput(value === "0" ? "" : value)}
        onChange={(e) => {
          onValue(parseCurrencyInput(e.target.value));
          if (errorKey && errors[errorKey]) setErrors((prev) => ({ ...prev, [errorKey]: "" }));
        }}
        aria-invalid={Boolean(errorKey && errors[errorKey])}
        className={`${ui.input} ${errorKey && errors[errorKey] ? ob.invalid : ""}`}
      />
    </div>
  );

  const udhaarStep = (kind: "supplier" | "customer") => {
    const isSupplier = kind === "supplier";
    const enabled = isSupplier ? hasSupplierUdhaar : hasCustomerUdhaar;
    const setEnabled = isSupplier ? setHasSupplierUdhaar : setHasCustomerUdhaar;
    const amount = isSupplier ? supplierPayable : customerReceivable;
    const setAmount = isSupplier ? setSupplierPayable : setCustomerReceivable;
    const errKey = isSupplier ? "supplierPayable" : "customerReceivable";
    const rows: Array<{ name: string; mobile: string; openingBalance: number }> = isSupplier ? suppliers : customers;
    return (
      <>
        <StepHead
          step={currentStep}
          total={totalSteps}
          title={isSupplier ? "Supplier udhaar (payables)" : "Customer udhaar (receivables)"}
          description={
            isSupplier
              ? "Record money you currently owe to suppliers so payables are tracked from day one."
              : "Record money customers currently owe you so customer khata starts accurate."
          }
        />
        <div className={ob.stepBody}>
          <div className={ob.block}>
            <div className={ob.blockHead}>
              <div className={ob.blockTitle}>
                <span className={ob.iconTile}>
                  <Icon name={isSupplier ? "truck" : "users"} size={16} />
                </span>
                <div>
                  <h2>{isSupplier ? "Do you owe money to suppliers?" : "Do customers currently owe you money?"}</h2>
                  <p>{isSupplier ? "Supplier khata / payables" : "Customer khata / receivables"}</p>
                </div>
              </div>
              <YesNo value={enabled} onChange={setEnabled} label={isSupplier ? "Supplier udhaar" : "Customer udhaar"} />
            </div>

            {enabled && (
              <div className={ob.inset}>
                <div className={ob.field}>
                  <label className={ob.label} htmlFor={`fps-${kind}-total`}>
                    {isSupplier ? "Total amount you owe suppliers" : "Total amount customers owe you"}
                  </label>
                  {moneyInput(`fps-${kind}-total`, amount, (raw) => setAmount(raw || "0"), isSupplier ? "850,000" : "1,250,000", errKey)}
                  <FieldError>{errors[errKey]}</FieldError>
                </div>

                <div className={ob.field}>
                  <div className={ob.labelRow}>
                    <span className={ob.label}>
                      {isSupplier ? "Individual suppliers" : "Individual customers"}
                      <i>{rows.length}</i>
                    </span>
                    <button
                      type="button"
                      className={ob.linkAction}
                      onClick={() => {
                        if (isSupplier) {
                          setSuppModalError("");
                          setShowAddSupplierModal(true);
                        } else {
                          setCustModalError("");
                          setShowAddCustomerModal(true);
                        }
                      }}
                    >
                      <Icon name="plus" size={14} />
                      {isSupplier ? "Add supplier" : "Add customer"}
                    </button>
                  </div>
                  {rows.length > 0 ? (
                    <div className={ob.list}>
                      {rows.map((r, i) => (
                        <div key={i} className={ob.listRow}>
                          <div className="min-w-0 truncate">
                            <strong>{r.name}</strong>
                            {r.mobile && <small>{r.mobile}</small>}
                          </div>
                          <div className={ob.listMeta}>
                            <b className={isSupplier ? "text-[var(--warn)]" : "text-[var(--pos)]"}>Rs {r.openingBalance.toLocaleString()}</b>
                            <button
                              type="button"
                              className={ob.remove}
                              aria-label={`Remove ${r.name}`}
                              onClick={() =>
                                isSupplier
                                  ? setSuppliers(suppliers.filter((_, idx) => idx !== i))
                                  : setCustomers(customers.filter((_, idx) => idx !== i))
                              }
                            >
                              <Icon name="x" size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={ob.muted}>
                      You don&apos;t have to enter every {isSupplier ? "supplier" : "customer"} now — you can add them anytime.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <OnboardingFrame
      context={targetBusiness?.name || "Your business workspace"}
      railEyebrow="Financial Starting Point"
      railTitle="Bring your books in"
      railText="Set your opening balances once so every report starts accurate. Every step is optional."
      steps={FPS_STEPS}
      current={currentStep}
      topRight={
        <button type="button" onClick={() => router.push("/dashboard")} className={ob.ghostLink}>
          Skip to dashboard
        </button>
      }
    >
      {/* ================= STEP 1: FINANCIAL STARTING POINT ================= */}
      {currentStep === 1 && (
        <>
          <StepHead
            step={1}
            total={totalSteps}
            title="Financial starting point"
            description="Establish your accounting baseline and the cash you have on hand today."
          />
          <div className={ob.stepBody}>
            <div className={ob.block}>
              <div className={ob.blockHead}>
                <div className={ob.blockTitle}>
                  <span className={ob.iconTile}>
                    <Icon name="calendar" size={16} />
                  </span>
                  <div>
                    <h2>When do you want to start your accounts?</h2>
                    <p>Transactions before this date won&apos;t affect your books.</p>
                  </div>
                </div>
              </div>
              <div className={ob.choices} role="radiogroup" aria-label="Accounting start date">
                {[
                  { id: "today", label: "Today", desc: new Date().toLocaleDateString() },
                  {
                    id: "month_start",
                    label: "Start of this month",
                    desc: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString(),
                  },
                  { id: "custom", label: "Custom date", desc: "Pick any date" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={dateOption === opt.id}
                    onClick={() => setDateOption(opt.id as typeof dateOption)}
                    className={`${ob.choice} ${dateOption === opt.id ? ob.choiceOn : ""}`}
                  >
                    <strong>{opt.label}</strong>
                    <span className="font-mono">{opt.desc}</span>
                  </button>
                ))}
              </div>
              {dateOption === "custom" && (
                <div className={`${ob.field} mt-4 max-w-[260px] al-pop`}>
                  <label className={ob.label} htmlFor="fps-date">
                    Accounting start date
                  </label>
                  <input
                    id="fps-date"
                    type="date"
                    value={customDate}
                    onChange={(e) => {
                      setCustomDate(e.target.value);
                      if (errors.customDate) setErrors((prev) => ({ ...prev, customDate: "" }));
                    }}
                    className={`${ui.input} ${errors.customDate ? ob.invalid : ""}`}
                  />
                  <FieldError>{errors.customDate}</FieldError>
                </div>
              )}
            </div>

            <div className={ob.block}>
              <div className={ob.blockHead}>
                <div className={ob.blockTitle}>
                  <span className={ob.iconTile}>
                    <Icon name="coins" size={16} />
                  </span>
                  <div>
                    <h2>
                      Opening cash balance <span className="font-normal text-[var(--faint)]">· optional</span>
                    </h2>
                    <p>How much physical cash is in your shop drawer or locker right now?</p>
                  </div>
                </div>
              </div>
              {moneyInput("fps-cash", openingCash, (raw) => setOpeningCash(raw || "0"), "500,000", "openingCash")}
              <FieldError>{errors.openingCash}</FieldError>
            </div>

            <div className={ob.block}>
              <div className={ob.blockHead}>
                <div className={ob.blockTitle}>
                  <span className={ob.iconTile}>
                    <Icon name="bank" size={16} />
                  </span>
                  <div>
                    <h2>Do you have business bank accounts?</h2>
                    <p>Include current balances to track deposits and transfers.</p>
                  </div>
                </div>
                <YesNo value={hasBank} onChange={setHasBank} label="Business bank accounts" />
              </div>

              {hasBank && (
                <div className={ob.inset}>
                  {bankAccounts.map((account, idx) => (
                    <div key={idx} className="flex flex-col gap-1.5">
                      <div className={ob.bankRow}>
                        <input
                          type="text"
                          placeholder="Bank name (e.g. Meezan, HBL) *"
                          aria-label="Bank name"
                          value={account.bankName}
                          onChange={(e) => updateBankAccount(idx, "bankName", e.target.value)}
                          className={`${ui.input} ${errors[`bankName_${idx}`] ? ob.invalid : ""}`}
                        />
                        <input
                          type="text"
                          placeholder="Account number (optional)"
                          aria-label="Account number"
                          value={account.accountNumber}
                          onChange={(e) => updateBankAccount(idx, "accountNumber", e.target.value)}
                          className={`${ui.input} font-mono`}
                        />
                        <div className={ob.money}>
                          <span>Rs</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Balance"
                            aria-label="Balance"
                            value={formatCurrencyInput(account.balance || "")}
                            onChange={(e) => {
                              const raw = parseCurrencyInput(e.target.value);
                              updateBankAccount(idx, "balance", Number(raw) || 0);
                            }}
                            className={ui.input}
                          />
                        </div>
                        {bankAccounts.length > 1 ? (
                          <button type="button" onClick={() => removeBankAccount(idx)} className={`${ob.remove} mt-[5px]`} aria-label="Remove bank account">
                            <Icon name="trash" size={14} />
                          </button>
                        ) : (
                          <span />
                        )}
                      </div>
                      <FieldError>{errors[`bankName_${idx}`]}</FieldError>
                    </div>
                  ))}
                  <div>
                    <button type="button" onClick={addBankAccount} className={ob.linkAction}>
                      <Icon name="plus" size={14} />
                      Add another bank account
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ================= STEP 2 / 3: UDHAAR ================= */}
      {currentStep === 2 && udhaarStep("supplier")}
      {currentStep === 3 && udhaarStep("customer")}

      {/* ================= STEP 4: INVENTORY ================= */}
      {currentStep === 4 && (
        <>
          <StepHead
            step={4}
            total={totalSteps}
            title="Inventory & stock"
            description="Track physical items and stock valuation, and bring in your existing catalogue."
          />
          <div className={ob.stepBody}>
            <div className={ob.block}>
              <div className={ob.blockHead}>
                <div className={ob.blockTitle}>
                  <span className={ob.iconTile}>
                    <Icon name="box" size={16} />
                  </span>
                  <div>
                    <h2>Manage your stock in Almadel?</h2>
                    <p>Barcodes, quantities and low-stock warnings.</p>
                  </div>
                </div>
                <YesNo value={manageStock} onChange={setManageStock} label="Manage stock" />
              </div>

              {manageStock && (
                <div className={ob.inset}>
                  <div className={ob.field}>
                    <label className={ob.label} htmlFor="fps-stock-value">
                      Estimated current stock value
                    </label>
                    <span className={ob.hint}>Total value of everything currently on your shelves.</span>
                    {moneyInput("fps-stock-value", currentStockValue, (raw) => setCurrentStockValue(raw || "0"), "5,500,000", "currentStockValue")}
                    <FieldError>{errors.currentStockValue}</FieldError>
                  </div>

                  <div className="border-t border-[var(--border)] pt-4">
                    <div className={ob.blockHead}>
                      <div className={ob.blockTitle}>
                        <div>
                          <h3>Add existing stock items now</h3>
                          <p>Import from CSV / Excel, or add items one by one.</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setWantAddStockNow(!wantAddStockNow)} className={ui.secondary} aria-expanded={wantAddStockNow}>
                        <Icon name={wantAddStockNow ? "minus" : "upload"} size={14} />
                        {wantAddStockNow ? "Hide importer" : "Import stock"}
                      </button>
                    </div>

                    {wantAddStockNow && (
                      <div className="al-pop flex flex-col gap-3">
                        <div className="flex flex-wrap gap-2">
                          <label className={ui.secondary}>
                            <Icon name="file" size={14} />
                            Upload CSV / Excel
                            <input type="file" accept=".csv,.txt" onChange={handleCsvImport} className="hidden" />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setProdModalError("");
                              setShowProductModal(true);
                            }}
                            className={ui.secondary}
                          >
                            <Icon name="plus" size={14} />
                            Add item manually
                          </button>
                        </div>

                        {products.length > 0 && (
                          <div className={ob.field}>
                            <span className={ob.label}>
                              Staged products<i>{products.length}</i>
                            </span>
                            <div className={ob.list}>
                              {products.map((p, idx) => (
                                <div key={idx} className={ob.listRow}>
                                  <div className="min-w-0 truncate">
                                    <strong>{p.name}</strong>
                                    <small className="font-mono">
                                      {p.barcode} · qty {p.stock}
                                    </small>
                                  </div>
                                  <div className={ob.listMeta}>
                                    <b>Rs {p.sellingPrice.toLocaleString()}</b>
                                    <button
                                      type="button"
                                      className={ob.remove}
                                      aria-label={`Remove ${p.name}`}
                                      onClick={() => setProducts(products.filter((_, i) => i !== idx))}
                                    >
                                      <Icon name="x" size={14} />
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
          </div>
        </>
      )}

      {/* ================= STEP 5: TAX INFORMATION ================= */}
      {currentStep === 5 && (
        <>
          <StepHead
            step={5}
            total={totalSteps}
            title="Tax information"
            description="Optional registration details for FBR, NTN and tax-invoice compliance."
          />
          <div className={ob.stepBody}>
            <div className={ob.block}>
              <div className={ob.blockHead}>
                <div className={ob.blockTitle}>
                  <span className={ob.iconTile}>
                    <Icon name="shield" size={16} />
                  </span>
                  <div>
                    <h2>Is your business registered for tax?</h2>
                    <p>You can add these details later from Settings.</p>
                  </div>
                </div>
              </div>
              <div className={ob.choices} role="radiogroup" aria-label="Tax registration">
                {[
                  { id: "yes", label: "Yes", desc: "Registered (NTN / STRN)" },
                  { id: "no", label: "No", desc: "Not registered yet" },
                  { id: "not_sure", label: "I'm not sure", desc: "Decide later" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={taxRegistered === opt.id}
                    onClick={() => {
                      setTaxRegistered(opt.id as typeof taxRegistered);
                      if (errors.ntn) setErrors((prev) => ({ ...prev, ntn: "" }));
                    }}
                    className={`${ob.choice} ${taxRegistered === opt.id ? ob.choiceOn : ""}`}
                  >
                    <strong>{opt.label}</strong>
                    <span>{opt.desc}</span>
                  </button>
                ))}
              </div>

              {taxRegistered === "yes" && (
                <div className={ob.inset}>
                  <div className={ob.grid2}>
                    <div className={ob.field}>
                      <label className={ob.label} htmlFor="fps-ntn">
                        National Tax Number (NTN)<em>*</em>
                      </label>
                      <input
                        id="fps-ntn"
                        type="text"
                        placeholder="e.g. 1234567-8"
                        value={ntn}
                        onChange={(e) => {
                          setNtn(e.target.value);
                          if (errors.ntn) setErrors((prev) => ({ ...prev, ntn: "" }));
                        }}
                        className={`${ui.input} font-mono ${errors.ntn ? ob.invalid : ""}`}
                      />
                      <FieldError>{errors.ntn}</FieldError>
                    </div>
                    <div className={ob.field}>
                      <label className={ob.label} htmlFor="fps-strn">
                        Sales Tax Reg. No. (STRN)<i>Optional</i>
                      </label>
                      <input
                        id="fps-strn"
                        type="text"
                        placeholder="e.g. 17-00-1234-567-89"
                        value={strn}
                        onChange={(e) => setStrn(e.target.value)}
                        className={`${ui.input} font-mono`}
                      />
                    </div>
                  </div>
                  <div className={ob.field}>
                    <label className={ob.label} htmlFor="fps-reg-name">
                      Business registration name
                    </label>
                    <input
                      id="fps-reg-name"
                      type="text"
                      placeholder="e.g. Al-Madina Mobile Center Private Limited"
                      value={taxBusinessName}
                      onChange={(e) => setTaxBusinessName(e.target.value)}
                      className={ui.input}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ================= STEP 6: BUSINESS LOGO ================= */}
      {currentStep === 6 && (
        <>
          <StepHead
            step={6}
            total={totalSteps}
            title="Logo & branding"
            description="Upload your logo. It appears on printed and digital receipts."
          />
          <div className={`${ob.stepBody} ${ob.grid2}`}>
            <div className={ob.drop}>
              {logoUrl ? (
                <>
                  <div className={ob.logoPreview}>
                    <img src={logoUrl} alt="Business logo" />
                  </div>
                  <button type="button" onClick={() => setLogoUrl("")} className={`${ui.danger} mt-3`}>
                    <Icon name="trash" size={14} />
                    Remove logo
                  </button>
                </>
              ) : (
                <>
                  <span className={ui.emptyIcon}>
                    <Icon name="image" size={19} />
                  </span>
                  <strong>Upload business logo</strong>
                  <span>PNG, JPG or WEBP up to 2MB</span>
                  <label className={`${ui.primary} mt-3`}>
                    <Icon name="upload" size={14} />
                    Choose file
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </>
              )}
            </div>

            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="mb-4 mt-0 text-[13.5px] font-medium">Your logo will appear on</p>
              <ul className={ob.checks}>
                {["Printed invoices & POS receipts", "Customer khata & ledger statements", "Automated WhatsApp invoices", "Exportable financial reports"].map(
                  (item) => (
                    <li key={item}>
                      <span>
                        <Icon name="check" size={12} strokeWidth={2.2} />
                      </span>
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </div>
        </>
      )}

      {/* Navigation */}
      <div className={ob.nav}>
        {currentStep > 1 ? (
          <button type="button" onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))} className={`${ui.secondary} ${ob.navCta}`}>
            <Icon name="left" size={15} />
            Back
          </button>
        ) : (
          <span className="hidden sm:block" />
        )}

        {currentStep < totalSteps ? (
          <button type="button" onClick={handleNextStep} className={`${ui.primary} ${ob.navCta}`}>
            Save & continue
            <Icon name="arrowRight" size={15} />
          </button>
        ) : (
          <button type="button" disabled={isSubmitting} onClick={handleFinalSubmit} className={`${ui.primary} ${ob.navCta}`}>
            {isSubmitting ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-current border-t-transparent [animation:almadelSpin_700ms_linear_infinite]" />
                Completing setup…
              </>
            ) : (
              <>
                Finish & enter workspace
                <Icon name="arrowRight" size={15} />
              </>
            )}
          </button>
        )}
      </div>

      {showAddCustomerModal && (
        <QuickSheet title="Add customer khata" icon="users" onSubmit={handleAddCustomer} onClose={() => setShowAddCustomerModal(false)} error={custModalError} submitLabel="Save customer">
          <>
            <div className={ui.field}>
              <label htmlFor="q-cust-name">Customer name *</label>
              <input id="q-cust-name" type="text" required placeholder="e.g. Ali Raza" value={custDraft.name} onChange={(e) => setCustDraft({ ...custDraft, name: e.target.value })} className={ui.input} />
            </div>
            <div className={ui.field}>
              <label htmlFor="q-cust-mobile">Mobile number *</label>
              <input id="q-cust-mobile" type="tel" required maxLength={15} placeholder="03001234567" value={custDraft.mobile} onChange={(e) => setCustDraft({ ...custDraft, mobile: sanitizePhoneInput(e.target.value) })} className={ui.input} />
            </div>
            <div className={ui.field}>
              <label htmlFor="q-cust-bal">Opening amount owed (Rs)</label>
              <input id="q-cust-bal" type="text" inputMode="numeric" placeholder="25,000" value={formatCurrencyInput(custDraft.balance)} onChange={(e) => setCustDraft({ ...custDraft, balance: parseCurrencyInput(e.target.value) })} className={`${ui.input} font-mono`} />
            </div>
          </>
        </QuickSheet>
      )}

      {showAddSupplierModal && (
        <QuickSheet title="Add supplier khata" icon="truck" onSubmit={handleAddSupplier} onClose={() => setShowAddSupplierModal(false)} error={suppModalError} submitLabel="Save supplier">
          <>
            <div className={ui.field}>
              <label htmlFor="q-supp-name">Supplier / vendor name *</label>
              <input id="q-supp-name" type="text" required placeholder="e.g. Hafeez Center Wholesale" value={suppDraft.name} onChange={(e) => setSuppDraft({ ...suppDraft, name: e.target.value })} className={ui.input} />
            </div>
            <div className={ui.field}>
              <label htmlFor="q-supp-mobile">Mobile / WhatsApp *</label>
              <input id="q-supp-mobile" type="tel" required maxLength={15} placeholder="03219876543" value={suppDraft.mobile} onChange={(e) => setSuppDraft({ ...suppDraft, mobile: sanitizePhoneInput(e.target.value) })} className={ui.input} />
            </div>
            <div className={ui.field}>
              <label htmlFor="q-supp-bal">Amount you owe (Rs)</label>
              <input id="q-supp-bal" type="text" inputMode="numeric" placeholder="150,000" value={formatCurrencyInput(suppDraft.balance)} onChange={(e) => setSuppDraft({ ...suppDraft, balance: parseCurrencyInput(e.target.value) })} className={`${ui.input} font-mono`} />
            </div>
          </>
        </QuickSheet>
      )}

      {showProductModal && (
        <QuickSheet title="Add stock item" icon="box" onSubmit={handleAddProduct} onClose={() => setShowProductModal(false)} error={prodModalError} submitLabel="Add item">
          <>
            <div className={ui.field}>
              <label htmlFor="q-prod-name">Product name *</label>
              <input id="q-prod-name" type="text" required placeholder="e.g. Redmi Note 13 (8GB/256GB)" value={prodDraft.name} onChange={(e) => setProdDraft({ ...prodDraft, name: e.target.value })} className={ui.input} />
            </div>
            <div className={ob.grid2}>
              <div className={ui.field}>
                <label htmlFor="q-prod-cost">Cost price (Rs)</label>
                <input id="q-prod-cost" type="text" inputMode="numeric" placeholder="45,000" value={formatCurrencyInput(prodDraft.costPrice)} onChange={(e) => setProdDraft({ ...prodDraft, costPrice: parseCurrencyInput(e.target.value) })} className={`${ui.input} font-mono`} />
              </div>
              <div className={ui.field}>
                <label htmlFor="q-prod-sell">Selling price (Rs) *</label>
                <input id="q-prod-sell" type="text" inputMode="numeric" required placeholder="52,000" value={formatCurrencyInput(prodDraft.sellingPrice)} onChange={(e) => setProdDraft({ ...prodDraft, sellingPrice: parseCurrencyInput(e.target.value) })} className={`${ui.input} font-mono`} />
              </div>
            </div>
            <div className={ob.grid2}>
              <div className={ui.field}>
                <label htmlFor="q-prod-qty">Initial quantity</label>
                <input id="q-prod-qty" type="number" min="0" value={prodDraft.stock} onChange={(e) => setProdDraft({ ...prodDraft, stock: e.target.value })} className={`${ui.input} font-mono`} />
              </div>
              <div className={ui.field}>
                <label htmlFor="q-prod-barcode">Barcode / IMEI</label>
                <input id="q-prod-barcode" type="text" placeholder="Optional" value={prodDraft.barcode} onChange={(e) => setProdDraft({ ...prodDraft, barcode: e.target.value })} className={`${ui.input} font-mono`} />
              </div>
            </div>
          </>
        </QuickSheet>
      )}

      {/* Completion */}
      {setupComplete && (
        <div className={ui.modal}>
          <div className={`${ui.sheet} ${ob.center}`} style={{ width: "min(460px, 100%)" }} role="dialog" aria-modal="true" aria-label="Financial baseline ready">
            <span className={ob.seal}>
              <Icon name="check" size={26} strokeWidth={2} />
            </span>
            <span className={ob.badge}>
              <Icon name="sparkle" size={13} />
              30-day free trial
            </span>
            <h2 className="mb-1.5 mt-4 text-[22px] font-semibold tracking-[-0.03em]">Financial baseline ready</h2>
            <p className="m-0 max-w-[44ch] text-[13.5px] leading-relaxed text-[var(--muted)]">
              Your business is set up. Enjoy full access to every feature during your{" "}
              <strong className="font-medium text-[var(--text)]">30-day free trial</strong>.
            </p>
            <button type="button" onClick={handleActivateStripeTrial} disabled={activatingStripe} className={`${ui.primary} ${ob.navCta} ${ob.wide} mt-6`}>
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
            <span className={ob.secure}>
              <Icon name="lock" size={13} />
              Secure checkout powered by Stripe
            </span>
          </div>
        </div>
      )}
    </OnboardingFrame>
  );
}

function QuickSheet({
  title,
  icon,
  onSubmit,
  onClose,
  error,
  submitLabel,
  children,
}: {
  title: string;
  icon: IconName;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
  error: string;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className={ui.modal} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={onSubmit} className={ui.sheet} style={{ width: "min(440px, 100%)" }} role="dialog" aria-modal="true" aria-label={title}>
        <div className={ui.sheetHead}>
          <div className="flex items-center gap-2.5">
            <span className={ui.iconTile}>
              <Icon name={icon} size={15} />
            </span>
            <h2>{title}</h2>
          </div>
          <button type="button" className={ui.iconButton} onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        {error && (
          <div className="mb-4">
            <div className={ui.error} role="alert">
              <Icon name="alert" size={15} className="mt-px shrink-0" />
              {error}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-4">{children}</div>
        <div className={ui.formActions}>
          <button type="button" onClick={onClose} className={ui.secondary}>
            Cancel
          </button>
          <button type="submit" className={ui.primary}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function FinancialSetupPage() {
  return (
    <Suspense
      fallback={<LoadingScreen label="Preparing financial setup…" />}
    >
      <FinancialSetupContent />
    </Suspense>
  );
}
