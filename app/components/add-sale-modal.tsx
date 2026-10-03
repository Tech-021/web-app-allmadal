"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { api, fetchProductCatalog, Product, resolveImageUrl } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/app/components/language-context";
import { logActivity } from "@/app/lib/logger";
import { DetailedSaleReceipt, PosReceiptModal } from "@/app/components/pos-receipt-modal";
import { CameraBarcodeScannerModal } from "@/app/components/camera-barcode-scanner-modal";
import { parseCurrencyInput } from "@/app/lib/validators";
import { formatRs } from "@/app/components/figures";
import { useDebounce } from "@/hooks/useDebounce";
import { Icon } from "@/app/components/icons";
import { EASE, EASE_EXIT } from "@/app/components/motion";
import sm from "./add-sale-modal.module.css";

/* New Sale — the bottom-drawer POS workspace.
   Product grid on the left, the bill on the right (two steps on mobile).
   Checkout logic matches the counter POS: barcode Enter, camera scan, product default discounts,
   optional bill discount, cash tender with change. */

type CartLine = {
  product: Product;
  quantity: number;
  discountType: "none" | "fixed" | "percentage";
  discountValue: number;
};

type CustomerOption = { id: number; name: string; mobile: string; currentBalance?: number };
type Status = "idle" | "busy" | "done" | "error";

interface AddSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaleCompleted?: () => void;
  /** Kept for compatibility; New Sale always presents as the bottom drawer. */
  variant?: "modal" | "drawer";
}

const priceOf = (p: Product) => Number(p.sellingPrice ?? p.price ?? 0);
const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "–";
const monogram = (name: string) => {
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const digits = name.match(/\d+/)?.[0] ?? "";
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "") + (digits ? digits.slice(0, 2) : "")).toUpperCase().slice(0, 3) || "–";
};
const lineDiscountOf = (c: CartLine) => {
  const line = priceOf(c.product) * c.quantity;
  if (c.discountType === "fixed") return Math.min(line, c.discountValue * c.quantity);
  if (c.discountType === "percentage") return Math.round(line * (Math.min(100, c.discountValue) / 100));
  return 0;
};

export function AddSaleModal({ isOpen, onClose, onSaleCompleted }: AddSaleModalProps) {
  const { showToast, confirmDialog } = useToast();
  const { activeBusiness } = useBusiness();
  const { user } = useAuth();
  const { t } = useLanguage();
  const allowDiscounts = activeBusiness?.allowDiscounts !== false;

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [flash, setFlash] = useState<{ id: number; key: number } | null>(null);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [walkinName, setWalkinName] = useState("");
  const [walkinMobile, setWalkinMobile] = useState("");
  const [custOpen, setCustOpen] = useState(false);
  const [custQuery, setCustQuery] = useState("");
  const debouncedCustQuery = useDebounce(custQuery, 300);

  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountType, setDiscountType] = useState<"none" | "fixed" | "percentage">("none");
  const [discountValue, setDiscountValue] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [cashTendered, setCashTendered] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState<DetailedSaleReceipt | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerLast, setScannerLast] = useState<{ code: string; productName: string; price?: number; found: boolean } | null>(null);
  const [mobileStep, setMobileStep] = useState<"browse" | "bill">("browse");

  const dragControls = useDragControls();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const lockRef = useRef(false);
  const custRef = useRef<HTMLDivElement | null>(null);

  const businessId = activeBusiness?.id ?? null;

  const reset = useCallback(() => {
    setQuery("");
    setCategory("All");
    setCart([]);
    setCustomerId(null);
    setWalkinName("");
    setWalkinMobile("");
    setCustOpen(false);
    setCustQuery("");
    setDiscountOpen(false);
    setDiscountType("none");
    setDiscountValue("");
    setPaymentMethod("cash");
    setCashTendered("");
    setStatus("idle");
    setErrorMsg("");
    setMobileStep("browse");
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const [prod, cust] = await Promise.all([
        fetchProductCatalog().catch(() => [] as Product[]),
        api<{ customers: CustomerOption[] }>("/customers?limit=100").catch(() => ({ customers: [] as CustomerOption[] })),
      ]);
      setProducts(prod);
      setCustomers(cust.customers || []);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  // Fresh bill + catalog every time the drawer opens
  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reset();
    setReceipt(null);
    void loadCatalog();
    const id = window.setTimeout(() => searchRef.current?.focus(), 380);
    return () => window.clearTimeout(id);
  }, [isOpen, businessId, reset, loadCatalog]);

  // Server-side customer search when the list on hand doesn't have a match
  useEffect(() => {
    const q = debouncedCustQuery.trim();
    if (!isOpen || q.length < 2) return;
    let live = true;
    void api<{ customers: CustomerOption[] }>(`/customers?limit=20&q=${encodeURIComponent(q)}`)
      .then((r) => {
        if (!live) return;
        setCustomers((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...(r.customers || []).filter((c) => !seen.has(c.id))];
        });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [debouncedCustQuery, isOpen]);

  // Close the customer popover on outside click
  useEffect(() => {
    if (!custOpen) return;
    const onDown = (e: MouseEvent) => {
      if (custRef.current && !custRef.current.contains(e.target as Node)) setCustOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [custOpen]);

  /* ---------- catalog ---------- */

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((p) => {
      if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1);
    });
    return [{ name: "All", count: products.length }, ...Array.from(counts, ([name, count]) => ({ name, count }))];
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "All" && p.category !== category) return false;
      if (!q) return true;
      return [p.name, p.barcode, p.sku, p.category].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [products, query, category]);

  /* ---------- cart ---------- */

  const qtyOf = (id: number) => cart.find((c) => c.product.id === id)?.quantity ?? 0;

  const add = (product: Product) => {
    if (status === "busy" || status === "done") return;
    const stock = Number(product.stock || 0);
    const existing = cart.find((c) => c.product.id === product.id);
    if (stock <= 0) {
      showToast(t("sale.out_of_stock", "{name} is out of stock.").replace("{name}", product.name), "info");
      return;
    }
    if (existing && existing.quantity >= stock) {
      showToast(t("sale.only_in_stock", "Only {n} in stock.").replace("{n}", String(stock)), "info");
      return;
    }
    setCart((prev) =>
      existing
        ? prev.map((c) => (c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c))
        : [
            ...prev,
            {
              product,
              quantity: 1,
              discountType: allowDiscounts ? product.discountType || "none" : "none",
              discountValue: allowDiscounts ? Number(product.discountValue || 0) : 0,
            },
          ],
    );
    setFlash((f) => ({ id: product.id, key: (f?.key ?? 0) + 1 }));
    if (status === "error") setStatus("idle");
  };

  const setQty = (id: number, qty: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.product.id !== id) return c;
          const stock = Number(c.product.stock || 0);
          return { ...c, quantity: stock > 0 ? Math.min(qty, stock) : qty };
        })
        .filter((c) => c.quantity > 0),
    );
  };

  // Hardware scanners type the code and press Enter
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const code = query.trim().toLowerCase();
    if (!code) return;
    e.preventDefault();
    const exact = products.find((p) => (p.barcode || "").toLowerCase() === code || (p.sku || "").toLowerCase() === code);
    const target = exact ?? (visible.length === 1 ? visible[0] : undefined);
    if (target) {
      add(target);
      setQuery("");
    } else {
      showToast(t("sale.no_match", "No product matches “{q}”.").replace("{q}", query.trim()), "info");
    }
  };

  const onCameraScan = (code: string) => {
    const c = code.trim().toLowerCase();
    const match = products.find((p) => (p.barcode || "").toLowerCase() === c || (p.sku || "").toLowerCase() === c || String(p.id) === c);
    if (match) {
      add(match);
      setScannerLast({ code, productName: match.name, price: priceOf(match), found: true });
    } else {
      setScannerLast({ code, productName: t("scanner.not_found", "Product not found"), found: false });
    }
  };

  /* ---------- totals ---------- */

  const gross = cart.reduce((a, c) => a + priceOf(c.product) * c.quantity, 0);
  const lineDiscounts = cart.reduce((a, c) => a + lineDiscountOf(c), 0);
  const afterLines = Math.max(0, gross - lineDiscounts);
  const billDiscount = (() => {
    if (!allowDiscounts) return 0;
    const v = Number(parseCurrencyInput(discountValue)) || 0;
    if (discountType === "fixed") return Math.min(afterLines, Math.max(0, v));
    if (discountType === "percentage") return Math.round((afterLines * Math.min(100, Math.max(0, v))) / 100);
    return 0;
  })();
  const discountTotal = lineDiscounts + billDiscount;
  const total = Math.max(0, gross - discountTotal);
  const items = cart.reduce((a, c) => a + c.quantity, 0);
  const tendered = cashTendered.trim() === "" ? total : Number(parseCurrencyInput(cashTendered)) || 0;
  const change = paymentMethod === "cash" ? Math.max(0, tendered - total) : 0;
  const shortCash = paymentMethod === "cash" && tendered < total;
  const quickCash = Array.from(new Set([total, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000, Math.ceil(total / 5000) * 5000]))
    .filter((v) => v >= total && v > 0)
    .slice(0, 3);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const owes = Number(customer?.currentBalance || 0);

  /* ---------- checkout ---------- */

  const complete = async () => {
    if (lockRef.current || status === "busy" || status === "done") return;
    if (!cart.length) return;
    if (shortCash) {
      setStatus("error");
      setErrorMsg(t("sale.cash_short", "Cash received is less than the total (Rs {total}).").replace("{total}", formatRs(total)));
      return;
    }
    lockRef.current = true;
    setStatus("busy");
    setErrorMsg("");
    setCustOpen(false);
    const customerName = customer?.name || walkinName.trim() || "Walk-in Customer";
    const customerMobile = customer?.mobile || walkinMobile.trim();
    try {
      const res = await api<{ id: number; invoiceNumber: string; createdAt: string; totalAmount: number }>("/sales/checkout", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((c) => ({
            productId: c.product.id,
            barcode: c.product.barcode || undefined,
            quantity: c.quantity,
            discountType: c.discountType,
            discountValue: c.discountValue,
          })),
          customerName,
          customerMobile: customerMobile || undefined,
          discountType: allowDiscounts ? discountType : "none",
          discountValue: allowDiscounts ? Number(parseCurrencyInput(discountValue)) || 0 : 0,
          paymentMethod,
        }),
      });
      const created: DetailedSaleReceipt = {
        id: res.id,
        invoiceNumber: res.invoiceNumber || `ALM-${res.id}`,
        createdAt: res.createdAt || new Date().toISOString(),
        customerName,
        customerMobile,
        items: cart.map((c) => {
          const rate = priceOf(c.product);
          const d = lineDiscountOf(c);
          return { name: c.product.name, quantity: c.quantity, price: rate, total: rate * c.quantity - d, discountAmount: d, discountType: c.discountType, discountValue: c.discountValue };
        }),
        subtotal: gross,
        discountAmount: discountTotal,
        discountType,
        totalAmount: res.totalAmount ?? total,
        paymentMethod,
        cashTendered: paymentMethod === "cash" ? tendered : undefined,
        changeDue: paymentMethod === "cash" ? change : undefined,
        cashierName: user?.name,
      };
      setStatus("done");
      logActivity("SALE_CREATE", "Sales", `Completed sale #${created.invoiceNumber} for Rs ${formatRs(total)}`, created.invoiceNumber, {
        invoiceNumber: created.invoiceNumber,
        total,
        itemsCount: cart.length,
        paymentMethod,
      });
      showToast(
        t("sale.completed_toast", "Sale completed · {inv} · Rs {total}").replace("{inv}", created.invoiceNumber).replace("{total}", formatRs(total)),
        "success",
      );
      onSaleCompleted?.();
      window.setTimeout(() => setReceipt(created), 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setStatus("error");
      setErrorMsg(message || t("sale.payment_failed_body", "The connection dropped before the sale was saved. Nothing was charged and your bill is kept."));
      showToast(t("sale.payment_failed", "Payment failed"), "error");
    } finally {
      lockRef.current = false;
    }
  };

  /* ---------- closing ---------- */

  const requestClose = async () => {
    if (status === "busy") return;
    if (cart.length > 0 && status !== "done") {
      const discard = await confirmDialog({
        title: t("sale.discard_title", "Discard this sale?"),
        message: t("sale.discard_body", "{n} items · Rs {total} haven't been billed. Discarding clears the bill — this can't be undone.")
          .replace("{n}", String(items))
          .replace("{total}", formatRs(total)),
        confirmLabel: t("sale.discard", "Discard sale"),
        cancelLabel: t("sale.keep_editing", "Continue editing"),
        danger: true,
      });
      if (!discard) return;
    }
    onClose();
  };

  // Keyboard: F2 search, F9 complete, Esc close (not while the receipt, scanner or a confirm is up)
  useEffect(() => {
    if (!isOpen || receipt || scannerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"]')) return;
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F9") {
        e.preventDefault();
        void complete();
      } else if (e.key === "Escape") {
        if (custOpen) setCustOpen(false);
        else void requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // The page recedes behind the sheet while it is up (Main board), and toasts move to the top edge.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("al-sale-open", isOpen);
    return () => html.classList.remove("al-sale-open");
  }, [isOpen]);

  /** Pulled far or flung down: close (asks first if the bill has items; otherwise it springs back). */
  const onSheetDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 140 || info.velocity.y > 900) void requestClose();
  };

  const busy = status === "busy";
  const done = status === "done";

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="new-sale"
            className={`${sm.scrim} al-sale-sheet`}
            role="dialog"
            aria-modal="true"
            aria-label={t("sale.new_sale", "New sale")}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !receipt) void requestClose();
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.32, ease: EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.28, ease: "linear" } }}
          >
            <motion.section
              className={sm.sheet}
              initial={{ y: "104%" }}
              animate={{ y: 0, transition: { duration: 0.46, ease: EASE } }}
              exit={{ y: "104%", transition: { duration: 0.3, ease: EASE_EXIT } }}
              drag="y"
              dragListener={false}
              dragControls={dragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              onDragEnd={onSheetDragEnd}
            >
              <button
                type="button"
                className={sm.handle}
                aria-label={t("sale.drag_close", "Drag down to close the sale")}
                onPointerDown={(e) => {
                  if (status !== "busy") dragControls.start(e);
                }}
              >
                <i />
              </button>

              <header className={sm.head}>
                {mobileStep === "bill" && (
                  <button type="button" className={`${sm.iconBtn} ${sm.mobileOnly}`} onClick={() => setMobileStep("browse")} aria-label={t("sale.back", "Back to products")}>
                    <Icon name="left" size={18} />
                  </button>
                )}
                <div className={sm.headTitle}>
                  <h2>{mobileStep === "bill" ? <span className={sm.mobileTitle}>{t("sale.review_bill", "Review bill")}</span> : t("sale.new_sale", "New sale")}</h2>
                  <span className={sm.badgeN}>
                    {activeBusiness?.name || "Counter"} · {user?.name?.split(" ")[0] || "Staff"}
                  </span>
                </div>
                <span className={sm.keys}>
                  <kbd>F2</kbd> {t("sale.search", "search")} <kbd>F9</kbd> {t("sale.complete", "complete")} <kbd>Esc</kbd> {t("sale.close", "close")}
                </span>
                <button type="button" className={sm.closeBtn} onClick={() => void requestClose()} disabled={busy} aria-label={t("sale.close_sale", "Close new sale")}>
                  <Icon name="x" size={18} />
                </button>
              </header>

              <div className={`${sm.body} ${mobileStep === "bill" ? sm.showBill : ""}`}>
                {/* ================= Catalog ================= */}
                <div className={sm.catalog}>
                  <div className={sm.searchRow}>
                    <div className={sm.searchBox}>
                      <Icon name="search" size={17} />
                      <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onSearchKey}
                        placeholder={t("sale.search_placeholder", "Search product, SKU or scan barcode")}
                        aria-label={t("sale.search_products", "Search products")}
                      />
                      <kbd>F2</kbd>
                    </div>
                    <button type="button" className={sm.scanBtn} onClick={() => setScannerOpen(true)} aria-label={t("pos.scan_camera", "Scan with camera")}>
                      <Icon name="scan" size={17} />
                      <span>{t("sale.scan", "Scan")}</span>
                    </button>
                  </div>

                  <div className={sm.chips} role="tablist" aria-label={t("sale.categories", "Categories")}>
                    {categories.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        role="tab"
                        aria-selected={category === c.name}
                        className={`${sm.chip} ${category === c.name ? sm.chipOn : ""}`}
                        onClick={() => setCategory(c.name)}
                      >
                        {c.name === "All" ? t("sale.all", "All") : c.name}
                        <span>{c.count}</span>
                      </button>
                    ))}
                  </div>

                  <div className={sm.grid}>
                    {loading &&
                      products.length === 0 &&
                      Array.from({ length: 8 }).map((_, i) => <span key={i} className={`${sm.cardSkeleton} al-skeleton`} aria-hidden />)}
                    {visible.map((p) => {
                      const stock = Number(p.stock || 0);
                      const low = stock > 0 && stock <= Number(p.lowStockThreshold || 5);
                      const q = qtyOf(p.id);
                      const img = resolveImageUrl(p.imageUrl);
                      const flashing = flash?.id === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={sm.card}
                          onClick={() => add(p)}
                          disabled={stock <= 0}
                          aria-label={`${t("sale.add", "Add")} ${p.name}, Rs ${formatRs(priceOf(p))}${stock <= 0 ? `, ${t("sale.out", "out of stock")}` : ""}`}
                        >
                          <span className={sm.thumb}>
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt="" />
                            ) : (
                              monogram(p.name)
                            )}
                            {q > 0 && <span className={sm.inCart}>× {q}</span>}
                          </span>
                          <span className={sm.cardName}>{p.name}</span>
                          <span className={sm.cardFoot}>
                            <span className={sm.mono}>Rs {formatRs(priceOf(p))}</span>
                            <small style={{ color: stock <= 0 ? "var(--neg)" : low ? "var(--warn)" : undefined }}>
                              {stock <= 0 ? t("sale.out_of_stock_short", "Out of stock") : low ? `${stock} ${t("sale.left", "left")}` : `${stock} ${t("sale.in_stock", "in stock")}`}
                            </small>
                          </span>
                          <span className={`${sm.addBtn} ${q > 0 ? sm.addBtnOn : ""}`} aria-hidden>
                            {q > 0 ? q : <Icon name="plus" size={18} strokeWidth={2} />}
                          </span>
                          {flashing && (
                            <span key={flash?.key} className={sm.plusOne} aria-hidden>
                              +1
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {!loading && visible.length === 0 && (
                      <div className={sm.noResults}>
                        <b>{t("sale.nothing_found", "Nothing matches “{q}”").replace("{q}", query || category)}</b>
                        <span>{t("sale.nothing_found_hint", "Try a product name, SKU or barcode.")}</span>
                      </div>
                    )}
                  </div>

                  {/* Mobile: sticky bill bar */}
                  <button type="button" className={sm.billBar} onClick={() => setMobileStep("bill")} disabled={!cart.length}>
                    <span>
                      <b className={sm.mono}>{items}</b>
                      {cart.length ? t("sale.review_bill", "Review bill") : t("sale.add_items", "Add items to start")}
                    </span>
                    <span className={sm.mono}>Rs {formatRs(total)}</span>
                  </button>
                </div>

                {/* ================= Bill ================= */}
                <div className={sm.bill}>
                  <div className={sm.custWrap} ref={custRef}>
                    <div className={sm.eyebrow}>{t("sale.customer", "Customer")}</div>
                    <button
                      type="button"
                      className={sm.custBtn}
                      onClick={() => setCustOpen((o) => !o)}
                      aria-haspopup="listbox"
                      aria-expanded={custOpen}
                      disabled={busy}
                    >
                      <span className={`${sm.av} ${customer ? sm.avOn : ""}`}>{customer ? initialsOf(customer.name) : "W"}</span>
                      <span className={sm.custText}>
                        <b>{customer?.name || walkinName || t("sale.walk_in", "Walk-in customer")}</b>
                        <small>{customer ? customer.mobile : walkinMobile || t("sale.walk_in_hint", "Tap to choose a saved customer")}</small>
                      </span>
                      {owes > 0 && <span className={sm.owes}>{t("sale.owes", "Owes")} Rs {formatRs(owes)}</span>}
                      <Icon name="down" size={15} />
                    </button>
                    {custOpen && (
                      <div className={sm.pop} role="listbox" aria-label={t("sale.choose_customer", "Choose customer")}>
                        <input
                          className={sm.popSearch}
                          value={custQuery}
                          onChange={(e) => setCustQuery(e.target.value)}
                          placeholder={t("sale.search_customer", "Search name or mobile")}
                          autoFocus
                        />
                        <div className={sm.popList}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={!customer}
                            className={sm.opt}
                            onClick={() => {
                              setCustomerId(null);
                              setCustOpen(false);
                            }}
                          >
                            <span className={sm.av}>W</span>
                            <span className={sm.custText}>
                              <b>{t("sale.walk_in", "Walk-in customer")}</b>
                              <small>{t("sale.no_account", "No saved account")}</small>
                            </span>
                          </button>
                          {customers
                            .filter((c) => {
                              const q = custQuery.trim().toLowerCase();
                              return !q || c.name.toLowerCase().includes(q) || (c.mobile || "").includes(q);
                            })
                            .slice(0, 30)
                            .map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                role="option"
                                aria-selected={customerId === c.id}
                                className={sm.opt}
                                onClick={() => {
                                  setCustomerId(c.id);
                                  setCustOpen(false);
                                }}
                              >
                                <span className={sm.av}>{initialsOf(c.name)}</span>
                                <span className={sm.custText}>
                                  <b>{c.name}</b>
                                  <small>{c.mobile}</small>
                                </span>
                                {Number(c.currentBalance || 0) > 0 && <span className={`${sm.mono} ${sm.optBal}`}>Rs {formatRs(Number(c.currentBalance))}</span>}
                              </button>
                            ))}
                        </div>
                        {!customer && (
                          <div className={sm.walkin}>
                            <input value={walkinName} onChange={(e) => setWalkinName(e.target.value)} placeholder={t("sale.walkin_name", "Name (optional)")} />
                            <input
                              value={walkinMobile}
                              onChange={(e) => setWalkinMobile(e.target.value)}
                              placeholder={t("sale.walkin_mobile", "Mobile (optional)")}
                              inputMode="tel"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={sm.lines}>
                    {cart.length === 0 ? (
                      <div className={sm.emptyBill}>
                        <span>
                          <Icon name="receipt" size={20} />
                        </span>
                        <b>{t("sale.bill_empty", "The bill is empty")}</b>
                        <small>{t("sale.bill_empty_hint", "Scan a barcode or tap a product to start this sale.")}</small>
                      </div>
                    ) : (
                      cart.map((c) => {
                        const rate = priceOf(c.product);
                        const d = lineDiscountOf(c);
                        return (
                          <div key={c.product.id} className={sm.line}>
                            <div className={sm.lineMain}>
                              <b>{c.product.name}</b>
                              <small className={sm.mono}>
                                Rs {formatRs(rate)} {t("sale.each", "each")}
                                {d > 0 ? ` · −${formatRs(d)}` : ""}
                              </small>
                            </div>
                            <div className={sm.step} role="group" aria-label={`${t("sale.qty_of", "Quantity of")} ${c.product.name}`}>
                              <button type="button" onClick={() => setQty(c.product.id, c.quantity - 1)} aria-label={t("sale.decrease", "Decrease quantity")} disabled={busy}>
                                <Icon name="minus" size={13} />
                              </button>
                              <span key={c.quantity} className={sm.bump}>
                                {c.quantity}
                              </span>
                              <button type="button" onClick={() => setQty(c.product.id, c.quantity + 1)} aria-label={t("sale.increase", "Increase quantity")} disabled={busy}>
                                <Icon name="plus" size={13} />
                              </button>
                            </div>
                            <span className={`${sm.mono} ${sm.lineTotal}`}>{formatRs(rate * c.quantity - d)}</span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className={sm.foot}>
                    <div className={sm.sums}>
                      <div>
                        <span>
                          {t("sale.subtotal", "Subtotal")} · {items} {t("sale.items", "items")}
                        </span>
                        <span className={sm.mono}>{formatRs(gross)}</span>
                      </div>
                      {allowDiscounts && (
                        <div>
                          {discountOpen || discountType !== "none" ? (
                            <span className={sm.discountCtl}>
                              <span className={sm.miniSeg}>
                                <button type="button" className={discountType !== "fixed" ? sm.miniOn : ""} onClick={() => setDiscountType("percentage")}>
                                  %
                                </button>
                                <button type="button" className={discountType === "fixed" ? sm.miniOn : ""} onClick={() => setDiscountType("fixed")}>
                                  Rs
                                </button>
                              </span>
                              <input
                                className={sm.mono}
                                value={discountValue}
                                onChange={(e) => {
                                  setDiscountValue(e.target.value);
                                  if (discountType === "none") setDiscountType("percentage");
                                }}
                                placeholder={discountType === "fixed" ? "200" : "5"}
                                inputMode="decimal"
                                aria-label={t("sale.discount", "Discount")}
                                autoFocus
                              />
                              <button
                                type="button"
                                className={sm.textBtn}
                                onClick={() => {
                                  setDiscountOpen(false);
                                  setDiscountType("none");
                                  setDiscountValue("");
                                }}
                                aria-label={t("sale.remove_discount", "Remove discount")}
                              >
                                <Icon name="x" size={13} />
                              </button>
                            </span>
                          ) : (
                            <button type="button" className={sm.addDiscount} onClick={() => setDiscountOpen(true)}>
                              + {t("sale.add_discount", "Add discount")}
                            </button>
                          )}
                          <span className={sm.mono}>{discountTotal ? `− ${formatRs(discountTotal)}` : "0"}</span>
                        </div>
                      )}
                    </div>
                    <div className={sm.total}>
                      <span>{t("sale.total", "Total")}</span>
                      <span className={`${sm.mono} ${sm.totalFig}`}>
                        <span className={sm.cur}>Rs</span>
                        {formatRs(total)}
                      </span>
                    </div>

                    <div className={sm.tiles} role="radiogroup" aria-label={t("sale.payment_method", "Payment method")}>
                      {(
                        [
                          ["cash", t("payment.cash", "Cash"), t("sale.drawer", "Drawer"), "pkr", "var(--c-cash)"],
                          ["online", t("payment.online", "Online"), t("sale.online_hint", "JazzCash · Easypaisa · Bank"), "phone", "var(--c-online)"],
                        ] as const
                      ).map(([id, label, hint, icon, color]) => (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={paymentMethod === id}
                          className={`${sm.tile} ${paymentMethod === id ? sm.tileOn : ""}`}
                          onClick={() => setPaymentMethod(id)}
                          disabled={busy}
                        >
                          <span className={sm.tileTop}>
                            <span style={{ color, display: "inline-flex" }}>
                              <Icon name={icon} size={17} />
                            </span>
                            <span className={sm.radio} />
                          </span>
                          <b>{label}</b>
                          <small>{hint}</small>
                        </button>
                      ))}
                    </div>

                    {paymentMethod === "cash" && total > 0 && (
                      <div className={sm.cashRow}>
                        <span className={sm.sub}>{t("sale.received", "Received")}</span>
                        {quickCash.map((v, i) => (
                          <button
                            key={v}
                            type="button"
                            className={`${sm.chip} ${sm.chipSm} ${tendered === v ? sm.chipOn : ""}`}
                            onClick={() => setCashTendered(String(v))}
                          >
                            {i === 0 ? t("sale.exact", "Exact") : formatRs(v)}
                          </button>
                        ))}
                        <input
                          className={`${sm.cashInput} ${sm.mono}`}
                          value={cashTendered}
                          onChange={(e) => setCashTendered(e.target.value)}
                          placeholder={formatRs(total)}
                          inputMode="numeric"
                          aria-label={t("sale.cash_received", "Cash received")}
                        />
                        <span className={sm.change}>
                          {t("sale.change", "Change")} <b className={sm.mono}>Rs {formatRs(change)}</b>
                        </span>
                      </div>
                    )}

                    {status === "error" && (
                      <div className={sm.errorBox} role="alert">
                        <Icon name="alert" size={17} />
                        <div>
                          <b>{shortCash ? t("sale.cash_short_title", "Not enough cash") : t("sale.payment_failed", "Payment failed")}</b> — {errorMsg}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className={sm.cta}
                      onClick={() => void complete()}
                      disabled={!cart.length || busy || done}
                      aria-busy={busy}
                      aria-keyshortcuts="F9"
                    >
                      {status === "idle" && (
                        <>
                          <span className={sm.ctaLabel}>{t("sale.complete_sale", "Complete sale")}</span>
                          <span className={sm.mono}>Rs {formatRs(total)}</span>
                          <kbd>F9</kbd>
                        </>
                      )}
                      {busy && (
                        <>
                          <span className={sm.spin} />
                          {t("sale.processing", "Processing sale…")}
                        </>
                      )}
                      {status === "error" && (
                        <>
                          <Icon name="refresh" size={17} />
                          {t("sale.retry", "Retry payment")} · Rs {formatRs(total)}
                        </>
                      )}
                      {done && (
                        <>
                          <Icon name="check" size={18} strokeWidth={2.4} />
                          {t("sale.completed", "Sale completed")}
                        </>
                      )}
                    </button>
                  </div>

                  {done && (
                    <div className={sm.success} role="status">
                      <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
                        <circle className={sm.checkC} cx="36" cy="36" r="25" />
                        <path className={sm.checkP} d="M25 37l7 7 15-16" />
                      </svg>
                      <b>{t("sale.completed", "Sale completed")}</b>
                      <span className={`${sm.mono} ${sm.successFig}`}>Rs {formatRs(total)}</span>
                      <small>
                        {paymentMethod === "cash" ? t("payment.cash", "Cash") : t("payment.online", "Online")} · {customer?.name || walkinName || t("sale.walk_in", "Walk-in customer")}
                      </small>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <CameraBarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={onCameraScan}
        continuous
        lastScannedInfo={scannerLast}
        title={t("scanner.title", "Scan barcode")}
        subtitle={t("scanner.subtitle", "Point the camera at a product barcode to add it to the bill")}
      />

      <PosReceiptModal
        receipt={receipt}
        onClose={() => {
          setReceipt(null);
          onClose();
        }}
        onNewSale={() => {
          setReceipt(null);
          reset();
          void loadCatalog();
        }}
      />
    </>
  );
}
