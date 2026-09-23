"use client";

import React, { useState, useEffect, useMemo, FormEvent } from "react";
import { api, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { logActivity } from "@/app/lib/logger";
import { DetailedSaleReceipt, PosReceiptModal } from "@/app/components/pos-receipt-modal";
import { formatCurrencyInput, parseCurrencyInput } from "@/app/lib/validators";

interface CartLine {
  productId: number;
  productName: string;
  barcode?: string;
  price: number;
  quantity: number;
  maxStock: number;
}

interface CustomerOption {
  id: number;
  name: string;
  mobile: string;
}

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleCompleted?: () => void;
}

export function AddSaleModal({ isOpen, onClose, onSaleCompleted }: AddSaleModalProps) {
  const { showToast } = useToast();
  const { activeBusiness } = useBusiness();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Cart state
  const [lines, setLines] = useState<CartLine[]>([]);

  // Customer state
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">("walkin");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [walkinName, setWalkinName] = useState<string>("");
  const [walkinMobile, setWalkinMobile] = useState<string>("");

  // Discount state
  const [discountType, setDiscountType] = useState<"none" | "fixed" | "percentage">("none");
  const [discountValue, setDiscountValue] = useState<string>("0");

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [cashTendered, setCashTendered] = useState<string>("");

  // Submit & receipt
  const [submitting, setSubmitting] = useState(false);
  const [createdReceipt, setCreatedReceipt] = useState<DetailedSaleReceipt | null>(null);

  // Load products & customers
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function fetchData() {
      setLoadingData(true);
      try {
        const [prodRes, custRes] = await Promise.all([
          api<Product[]>("/products").catch(() => []),
          api<{ customers: CustomerOption[] }>("/customers").catch(() => ({ customers: [] })),
        ]);
        if (mounted) {
          setProducts(Array.isArray(prodRes) ? prodRes : []);
          setCustomers(custRes.customers || []);
        }
      } catch (e) {
        console.error("Failed to load POS data:", e);
      } finally {
        if (mounted) setLoadingData(false);
      }
    }

    void fetchData();
    return () => {
      mounted = false;
    };
  }, [isOpen, activeBusiness?.id]);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setLines([
        {
          productId: 0,
          productName: "",
          price: 0,
          quantity: 1,
          maxStock: 0,
        },
      ]);
      setCustomerMode("walkin");
      setSelectedCustomerId("");
      setWalkinName("");
      setWalkinMobile("");
      setDiscountType("none");
      setDiscountValue("0");
      setPaymentMethod("cash");
      setCashTendered("");
      setCreatedReceipt(null);
    }
  }, [isOpen]);

  // Handle line change
  const handleProductSelect = (index: number, productId: number) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const updated = [...lines];
    const unitPrice = Number(prod.sellingPrice ?? prod.price ?? 0);
    updated[index] = {
      productId: prod.id,
      productName: prod.name,
      barcode: prod.barcode || "",
      price: unitPrice,
      quantity: 1,
      maxStock: Number(prod.stock || 0),
    };
    setLines(updated);
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const updated = [...lines];
    const max = updated[index].maxStock;
    const finalQty = Math.max(1, max > 0 ? Math.min(qty, max) : qty);
    updated[index].quantity = finalQty;
    setLines(updated);
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        productId: 0,
        productName: "",
        price: 0,
        quantity: 1,
        maxStock: 0,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      setLines([
        {
          productId: 0,
          productName: "",
          price: 0,
          quantity: 1,
          maxStock: 0,
        },
      ]);
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return lines.reduce((acc, curr) => {
      if (!curr.productId) return acc;
      return acc + curr.price * curr.quantity;
    }, 0);
  }, [lines]);

  const discountAmount = useMemo(() => {
    const val = Number(parseCurrencyInput(discountValue)) || 0;
    if (discountType === "fixed") {
      return Math.min(subtotal, Math.max(0, val));
    }
    if (discountType === "percentage") {
      const pct = Math.min(100, Math.max(0, val));
      return Math.round((subtotal * pct) / 100);
    }
    return 0;
  }, [subtotal, discountType, discountValue]);

  const grandTotal = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const changeDue = useMemo(() => {
    if (paymentMethod !== "cash") return 0;
    const tendered = Number(parseCurrencyInput(cashTendered)) || 0;
    return Math.max(0, tendered - grandTotal);
  }, [cashTendered, grandTotal, paymentMethod]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const validLines = lines.filter((l) => l.productId > 0);
    if (validLines.length === 0) {
      showToast("Please select at least one product.", "error");
      return;
    }

    // Check stock limits
    for (const l of validLines) {
      if (l.maxStock > 0 && l.quantity > l.maxStock) {
        showToast(`Quantity for ${l.productName} exceeds available stock (${l.maxStock}).`, "error");
        return;
      }
    }

    let customerName = walkinName.trim() || "Walk-in Customer";
    let customerMobile = walkinMobile.trim();

    if (customerMode === "existing" && selectedCustomerId) {
      const selected = customers.find((c) => String(c.id) === selectedCustomerId);
      if (selected) {
        customerName = selected.name;
        customerMobile = selected.mobile;
      }
    }

    const payload = {
      items: validLines.map((l) => ({
        productId: l.productId,
        barcode: l.barcode || undefined,
        quantity: l.quantity,
      })),
      customerName,
      customerMobile: customerMobile || undefined,
      discountType,
      discountValue: Number(parseCurrencyInput(discountValue)) || 0,
      paymentMethod,
    };

    setSubmitting(true);
    try {
      const response = await api<{
        id: number;
        invoiceNumber: string;
        createdAt: string;
        totalAmount: number;
        subtotal: number;
        discountAmount?: number;
      }>("/sales/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const receiptObj: DetailedSaleReceipt = {
        id: response.id,
        invoiceNumber: response.invoiceNumber || `ALM-${response.id}`,
        createdAt: response.createdAt || new Date().toISOString(),
        customerName,
        customerMobile,
        items: validLines.map((l) => ({
          name: l.productName,
          quantity: l.quantity,
          price: l.price,
          total: l.price * l.quantity,
        })),
        subtotal,
        discountAmount,
        discountType,
        totalAmount: response.totalAmount ?? grandTotal,
        paymentMethod,
        cashTendered: Number(parseCurrencyInput(cashTendered)) || undefined,
        changeDue: paymentMethod === "cash" ? changeDue : undefined,
      };

      setCreatedReceipt(receiptObj);
      showToast(`Sale recorded successfully! Invoice #${receiptObj.invoiceNumber}`, "success");

      logActivity(
        "SALE_CREATE",
        "Sales",
        `Completed sale #${receiptObj.invoiceNumber} for ₨ ${grandTotal.toLocaleString()}`,
        receiptObj.invoiceNumber,
        {
          invoiceNumber: receiptObj.invoiceNumber,
          total: grandTotal,
          itemsCount: validLines.length,
          paymentMethod,
        }
      );

      if (onSaleCompleted) {
        onSaleCompleted();
      }
    } catch (err: any) {
      console.error("Sale checkout error:", err);
      showToast(err.message || "Failed to complete sale.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs overflow-y-auto"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !createdReceipt) onClose();
        }}
      >
        <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden my-auto animate-in zoom-in-95">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-[#00875a] to-[#006644] text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="size-10 rounded-2xl bg-white/20 grid place-items-center text-xl">
                🛒
              </span>
              <div>
                <h3 className="text-lg font-black tracking-tight leading-tight">
                  New Sale / Bill Banayein
                </h3>
                <p className="text-xs text-emerald-100/90 font-medium">
                  {activeBusiness?.name || "Active Store"} • Record customer transaction
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold grid place-items-center transition cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* 1. Products Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📦</span> Products / Items
                </label>
                <button
                  type="button"
                  onClick={handleAddLine}
                  className="px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#00875a] font-bold text-xs transition cursor-pointer flex items-center gap-1"
                >
                  <span>+</span> Add Another Item
                </button>
              </div>

              {loadingData ? (
                <div className="p-4 text-center text-xs text-gray-500 font-medium bg-gray-50 rounded-2xl">
                  Loading catalog products...
                </div>
              ) : products.length === 0 ? (
                <div className="p-4 text-center text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl">
                  No products in catalog. Please add products from the Products page first.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lines.map((line, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50/90 rounded-2xl border border-gray-200/70 flex flex-col sm:flex-row items-center gap-2.5"
                    >
                      {/* Product Selector */}
                      <div className="flex-1 w-full">
                        <select
                          value={line.productId || ""}
                          onChange={(e) => handleProductSelect(index, Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-800 outline-none focus:border-[#00875a]"
                          required
                        >
                          <option value="">-- Choose Product --</option>
                          {products.map((p) => {
                            const pPrice = Number(p.sellingPrice ?? p.price ?? 0);
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.barcode ? `(${p.barcode})` : ""} — ₨ {pPrice.toLocaleString()} (Stock: {p.stock})
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(index, line.quantity - 1)}
                          disabled={line.quantity <= 1}
                          className="size-8 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 font-bold text-sm text-gray-700 disabled:opacity-40"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={line.maxStock > 0 ? line.maxStock : undefined}
                          value={line.quantity}
                          onChange={(e) => handleQuantityChange(index, Number(e.target.value) || 1)}
                          className="w-14 text-center py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-black text-gray-900 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(index, line.quantity + 1)}
                          disabled={line.maxStock > 0 && line.quantity >= line.maxStock}
                          className="size-8 rounded-lg bg-white border border-gray-200 hover:bg-gray-100 font-bold text-sm text-gray-700 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="w-24 text-right shrink-0">
                        <span className="block text-xs font-black text-gray-900">
                          ₨ {(line.price * line.quantity).toLocaleString()}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold">
                          @ ₨ {line.price.toLocaleString()}
                        </span>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(index)}
                        className="size-8 rounded-lg text-red-500 hover:bg-red-50 grid place-items-center text-sm font-bold shrink-0 transition"
                        title="Remove product"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Customer Selection */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>👥</span> Customer Details
                </label>
                <div className="flex rounded-xl bg-slate-200/70 p-0.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setCustomerMode("walkin")}
                    className={`px-3 py-1 rounded-lg transition ${
                      customerMode === "walkin" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    Walk-in Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerMode("existing")}
                    className={`px-3 py-1 rounded-lg transition ${
                      customerMode === "existing" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
                    }`}
                  >
                    Select Khata Customer
                  </button>
                </div>
              </div>

              {customerMode === "walkin" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Customer Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Walk-in / Bilal"
                      value={walkinName}
                      onChange={(e) => setWalkinName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#00875a]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile / WhatsApp (Optional)</label>
                    <input
                      type="tel"
                      placeholder="03001234567"
                      value={walkinMobile}
                      onChange={(e) => setWalkinMobile(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#00875a]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Choose Customer from Khata</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#00875a]"
                  >
                    <option value="">-- Choose Existing Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.mobile})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 3. Discount & Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Discount Section */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2.5">
                <label className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>🏷️</span> Apply Discount
                </label>
                <div className="flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="w-1/2 px-2.5 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-800 outline-none"
                  >
                    <option value="none">No Discount</option>
                    <option value="fixed">Fixed (₨ Off)</option>
                    <option value="percentage">Percent (% Off)</option>
                  </select>
                  {discountType !== "none" && (
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={discountType === "percentage" ? "10%" : "500"}
                      value={discountType === "fixed" ? formatCurrencyInput(discountValue) : discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="w-1/2 px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-900 outline-none focus:border-[#00875a]"
                    />
                  )}
                </div>
                {discountAmount > 0 && (
                  <p className="text-[11px] font-bold text-emerald-700">
                    Discount saving: ₨ {discountAmount.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Payment Method Section */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-2.5">
                <label className="text-xs font-black text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span>💳</span> Payment Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === "cash"
                        ? "bg-[#e6f4ed] text-[#00875a] border-[#00875a] ring-2 ring-[#00875a]/20"
                        : "bg-white text-gray-700 border-gray-200"
                    }`}
                  >
                    <span>💵</span> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("online")}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                      paymentMethod === "online"
                        ? "bg-[#e6f4ed] text-[#00875a] border-[#00875a] ring-2 ring-[#00875a]/20"
                        : "bg-white text-gray-700 border-gray-200"
                    }`}
                  >
                    <span>🏦</span> Online / Bank
                  </button>
                </div>

                {paymentMethod === "cash" && (
                  <div className="pt-1 flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold text-gray-500 mb-0.5">Cash Tendered (₨)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="5,000"
                        value={formatCurrencyInput(cashTendered)}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-900 outline-none"
                      />
                    </div>
                    {changeDue > 0 && (
                      <div className="text-right">
                        <span className="block text-[10px] font-bold text-gray-500">Change Due</span>
                        <strong className="text-xs font-black text-emerald-700">₨ {changeDue.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 4. Financial Summary & Submit CTA */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 to-teal-950 text-white space-y-2">
              <div className="flex justify-between text-xs text-emerald-200/80">
                <span>Subtotal ({lines.filter((l) => l.productId > 0).length} items)</span>
                <span>₨ {subtotal.toLocaleString()}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-xs text-emerald-400 font-semibold">
                  <span>Discount</span>
                  <span>- ₨ {discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-2 border-t border-emerald-800">
                <span className="text-sm font-extrabold text-white uppercase tracking-wider">Total Bill</span>
                <span className="text-2xl font-black text-emerald-300">
                  ₨ {grandTotal.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || subtotal === 0}
                className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#00875a] to-[#006644] hover:from-[#00744e] hover:to-[#005236] text-white font-black text-sm shadow-lg shadow-[#00875a]/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span>Processing Sale...</span>
                ) : (
                  <>
                    <span>Complete Sale (Bill Banayein)</span>
                    <span className="text-base font-bold">➔</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Instant Print Modal after sale */}
      {createdReceipt && (
        <PosReceiptModal
          receipt={createdReceipt}
          onClose={() => {
            setCreatedReceipt(null);
            onClose();
          }}
          onNewSale={() => {
            setCreatedReceipt(null);
          }}
        />
      )}
    </>
  );
}
