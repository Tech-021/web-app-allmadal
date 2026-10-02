"use client";

import React, { useState, useEffect, useMemo, useRef, FormEvent } from "react";
import { api, fetchProductCatalog, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { logActivity } from "@/app/lib/logger";
import { DetailedSaleReceipt, PosReceiptModal } from "@/app/components/pos-receipt-modal";
import { formatCurrencyInput, parseCurrencyInput } from "@/app/lib/validators";
import { Icon, type IconName } from "@/app/components/icons";
import ui from "@/app/components/workspace-ui.module.css";
import sm from "./add-sale-modal.module.css";

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
  const activeBusinessId = activeBusiness?.id ?? null;

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
  const checkoutLockRef = useRef(false);

  // Reset form and load catalog when modal opens or active business changes.
  useEffect(() => {
    if (!isOpen) return;

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

    if (!activeBusinessId) {
      setProducts([]);
      setCustomers([]);
      setLoadingData(false);
      return;
    }

    let mounted = true;
    async function fetchData() {
      setLoadingData(true);
      try {
        const [prodRes, custRes] = await Promise.all([
          fetchProductCatalog().catch(() => []),
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
  }, [isOpen, activeBusinessId]);

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

    if (checkoutLockRef.current) return;
    checkoutLockRef.current = true;
    setSubmitting(true);

    try {
      const validLines = lines.filter((l) => l.productId > 0);
      if (validLines.length === 0) {
        showToast("Please select at least one product.", "error");
        return;
      }

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
      checkoutLockRef.current = false;
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const sectionTitle = (icon: IconName, label: string) => (
    <span className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--text-2)]">
      <Icon name={icon} size={14} className="text-[var(--muted)]" />
      {label}
    </span>
  );

  return (
    <>
      <div
        className={ui.modal}
        role="dialog"
        aria-modal="true"
        aria-label="New sale"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !createdReceipt) onClose();
        }}
      >
        <div className={`${ui.sheet} ${sm.sheet}`}>
          <div className={ui.sheetHead}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={ui.iconTile}>
                <Icon name="cart" size={15} />
              </span>
              <div className="min-w-0">
                <h2>New sale / Bill Banayein</h2>
                <p className="m-0 mt-0.5 truncate text-[12.5px] text-[var(--muted)]">{activeBusiness?.name || "Active Store"} · record a customer transaction</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className={ui.iconButton} aria-label="Close">
              <Icon name="x" size={15} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* 1. Items */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                {sectionTitle("box", "Items")}
                <button type="button" onClick={handleAddLine} className={`${ui.secondary} ${ui.btnSm}`}>
                  <Icon name="plus" size={13} />
                  Add item
                </button>
              </div>

              {loadingData ? (
                <div className="flex flex-col gap-2">
                  <span className="al-skeleton block h-[52px] w-full" />
                  <span className="al-skeleton block h-[52px] w-full" />
                </div>
              ) : products.length === 0 ? (
                <div className={`${ui.notice} !border-[color-mix(in_oklab,var(--warn)_25%,transparent)] !bg-[var(--warn-soft)] !text-[var(--warn)]`}>
                  <Icon name="alert" size={15} className="mt-px shrink-0" />
                  No products in your catalogue yet. Add products from the Products page first.
                </div>
              ) : (
                <div className="overflow-hidden rounded-[11px] border border-[var(--border)]">
                  {lines.map((line, index) => (
                    <div key={index} className={`${sm.line} ${index > 0 ? "border-t border-[var(--border)]" : ""}`}>
                      <select
                        value={line.productId || ""}
                        onChange={(e) => handleProductSelect(index, Number(e.target.value))}
                        className={`${ui.select} ${sm.product}`}
                        required
                        aria-label={`Product for line ${index + 1}`}
                      >
                        <option value="">Choose product…</option>
                        {products.map((p) => {
                          const pPrice = Number(p.sellingPrice ?? p.price ?? 0);
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.barcode ? `(${p.barcode})` : ""} — Rs {pPrice.toLocaleString()} · stock {p.stock}
                            </option>
                          );
                        })}
                      </select>

                      <div className={sm.stepper}>
                        <button type="button" onClick={() => handleQuantityChange(index, line.quantity - 1)} disabled={line.quantity <= 1} aria-label="Decrease quantity">
                          <Icon name="minus" size={13} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={line.maxStock > 0 ? line.maxStock : undefined}
                          value={line.quantity}
                          onChange={(e) => handleQuantityChange(index, Number(e.target.value) || 1)}
                          aria-label="Quantity"
                        />
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(index, line.quantity + 1)}
                          disabled={line.maxStock > 0 && line.quantity >= line.maxStock}
                          aria-label="Increase quantity"
                        >
                          <Icon name="plus" size={13} />
                        </button>
                      </div>

                      <div className={sm.lineTotal}>
                        <span className="block font-mono text-[13px] font-medium">Rs {(line.price * line.quantity).toLocaleString()}</span>
                        <span className="font-mono text-[11px] text-[var(--faint)]">@ {line.price.toLocaleString()}</span>
                      </div>

                      <button type="button" onClick={() => handleRemoveLine(index)} className={`${ui.iconButton} hover:!text-[var(--neg)]`} title="Remove item" aria-label="Remove item">
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2. Customer */}
            <section className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {sectionTitle("user", "Customer")}
                <div className={ui.segmented} role="tablist" aria-label="Customer type">
                  <button type="button" role="tab" aria-selected={customerMode === "walkin"} onClick={() => setCustomerMode("walkin")} className={customerMode === "walkin" ? ui.segmentedOn : ""}>
                    Walk-in
                  </button>
                  <button type="button" role="tab" aria-selected={customerMode === "existing"} onClick={() => setCustomerMode("existing")} className={customerMode === "existing" ? ui.segmentedOn : ""}>
                    Khata customer
                  </button>
                </div>
              </div>

              {customerMode === "walkin" ? (
                <div className={ui.formGrid}>
                  <div className={ui.field}>
                    <label htmlFor="as-name">Name (optional)</label>
                    <input id="as-name" type="text" placeholder="Walk-in / Bilal" value={walkinName} onChange={(e) => setWalkinName(e.target.value)} className={ui.input} />
                  </div>
                  <div className={ui.field}>
                    <label htmlFor="as-mobile">Mobile / WhatsApp (optional)</label>
                    <input id="as-mobile" type="tel" placeholder="03001234567" value={walkinMobile} onChange={(e) => setWalkinMobile(e.target.value)} className={`${ui.input} ${ui.inputMono}`} />
                  </div>
                </div>
              ) : (
                <div className={ui.field}>
                  <label htmlFor="as-customer">Customer from khata</label>
                  <select id="as-customer" value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className={ui.select}>
                    <option value="">Choose existing customer…</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.mobile})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>

            {/* 3. Discount & payment */}
            <div className={ui.formGrid}>
              <section className="flex flex-col gap-2.5">
                {sectionTitle("tag", "Discount")}
                <div className="flex gap-2">
                  <select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)} className={ui.select} aria-label="Discount type">
                    <option value="none">No discount</option>
                    <option value="fixed">Fixed (Rs off)</option>
                    <option value="percentage">Percent (% off)</option>
                  </select>
                  {discountType !== "none" && (
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder={discountType === "percentage" ? "10" : "500"}
                      value={discountType === "fixed" ? formatCurrencyInput(discountValue) : discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className={`${ui.input} ${ui.inputMono}`}
                      aria-label="Discount value"
                    />
                  )}
                </div>
                {discountAmount > 0 && (
                  <span className="text-[12px] text-[var(--pos)]">
                    Saving <span className="font-mono">Rs {discountAmount.toLocaleString()}</span>
                  </span>
                )}
              </section>

              <section className="flex flex-col gap-2.5">
                {sectionTitle("card", "Payment")}
                <div className={ui.segmented} role="radiogroup" aria-label="Payment method">
                  <button type="button" role="radio" aria-checked={paymentMethod === "cash"} onClick={() => setPaymentMethod("cash")} className={`flex-1 justify-center ${paymentMethod === "cash" ? ui.segmentedOn : ""}`}>
                    <Icon name="coins" size={13} />
                    Cash
                  </button>
                  <button type="button" role="radio" aria-checked={paymentMethod === "online"} onClick={() => setPaymentMethod("online")} className={`flex-1 justify-center ${paymentMethod === "online" ? ui.segmentedOn : ""}`}>
                    <Icon name="bank" size={13} />
                    Online / bank
                  </button>
                </div>
                {paymentMethod === "cash" && (
                  <div className="flex items-end gap-3">
                    <div className={`${ui.field} flex-1`}>
                      <label htmlFor="as-tendered">Cash tendered (Rs)</label>
                      <input
                        id="as-tendered"
                        type="text"
                        inputMode="numeric"
                        placeholder="5,000"
                        value={formatCurrencyInput(cashTendered)}
                        onChange={(e) => setCashTendered(e.target.value)}
                        className={`${ui.input} ${ui.inputMono}`}
                      />
                    </div>
                    {changeDue > 0 && (
                      <div className="pb-2 text-right">
                        <span className="block text-[11.5px] text-[var(--muted)]">Change due</span>
                        <strong className="font-mono text-[14px] font-medium text-[var(--pos)]">Rs {changeDue.toLocaleString()}</strong>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>

            {/* 4. Summary */}
            <dl className={`${ui.kv} ${sm.summary}`}>
              <div>
                <dt>Subtotal · {lines.filter((l) => l.productId > 0).length} items</dt>
                <dd className="font-mono">Rs {subtotal.toLocaleString()}</dd>
              </div>
              {discountAmount > 0 && (
                <div>
                  <dt>Discount</dt>
                  <dd className="font-mono !text-[var(--pos)]">− Rs {discountAmount.toLocaleString()}</dd>
                </div>
              )}
              <div className={ui.kvTotal}>
                <dt>Total bill</dt>
                <dd className="font-mono !text-[22px] tracking-[-0.03em]">Rs {grandTotal.toLocaleString()}</dd>
              </div>
            </dl>

            <div className={`${ui.formActions} !mt-0`}>
              <button type="button" onClick={onClose} className={ui.secondary}>
                Cancel
              </button>
              <button type="submit" disabled={submitting || subtotal === 0} className={`${ui.primary} ${ui.btnLg}`}>
                {submitting ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-current border-t-transparent [animation:almadelSpin_700ms_linear_infinite]" />
                    Processing sale…
                  </>
                ) : (
                  <>
                    <Icon name="check" size={15} />
                    Complete sale (Bill Banayein)
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
