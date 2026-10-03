"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api, fetchProductCatalog, Product, resolveImageUrl } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { logActivity } from "@/app/lib/logger";
import { DetailedSaleReceipt, PosReceiptModal } from "@/app/components/pos-receipt-modal";
import { formatCurrencyInput, parseCurrencyInput } from "@/app/lib/validators";
import { useLanguage } from "@/app/components/language-context";
import { CameraBarcodeScannerModal } from "@/app/components/camera-barcode-scanner-modal";
import { PaginationControls } from "@/app/components/pagination-controls";
import { Icon } from "@/app/components/icons";
import { AnimatedNumber, Skeleton } from "@/app/components/motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";

interface PosCartItem {
  product: Product;
  quantity: number;
  discountType?: "none" | "fixed" | "percentage";
  discountValue?: number;
}

interface CustomerOption {
  id: number;
  name: string;
  mobile: string;
}

interface PosTerminalProps {
  onSaleCompleted?: () => void;
}

export function PosTerminal({ onSaleCompleted }: PosTerminalProps) {
  const { showToast } = useToast();
  const { activeBusiness } = useBusiness();
  const { t } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Catalog Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [catalogPage, setCatalogPage] = useState<number>(1);
  const [catalogPageSize, setCatalogPageSize] = useState<number>(12);

  // Camera Barcode Scanner
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerLastScanned, setScannerLastScanned] = useState<{
    code: string;
    productName?: string;
    price?: number;
    found?: boolean;
  } | null>(null);

  // Cart
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [editingDiscountProductId, setEditingDiscountProductId] = useState<number | null>(null);

  // Customer
  const [customerMode, setCustomerMode] = useState<"walkin" | "existing">("walkin");
  const [walkinName, setWalkinName] = useState("");
  const [walkinMobile, setWalkinMobile] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // Discount
  const [discountType, setDiscountType] = useState<"none" | "fixed" | "percentage">("none");
  const [discountValue, setDiscountValue] = useState<string>("0");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [cashTendered, setCashTendered] = useState<string>("");

  // Submit & Receipt
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<DetailedSaleReceipt | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const checkoutLockRef = useRef(false);

  const businessId = activeBusiness?.id;

  const resetCheckoutState = useCallback(() => {
    setCart([]);
    setEditingDiscountProductId(null);
    setCustomerMode("walkin");
    setWalkinName("");
    setWalkinMobile("");
    setSelectedCustomerId("");
    setDiscountType("none");
    setDiscountValue("0");
    setPaymentMethod("cash");
    setCashTendered("");
    setReceipt(null);
    setSearchQuery("");
    setSelectedCategory("all");
    setCatalogPage(1);
    setScannerLastScanned(null);
  }, []);

  // Fetch products and customers for the active business (x-business-id from context).
  const loadData = useCallback(async () => {
    if (!businessId) {
      setProducts([]);
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [prodRes, custRes] = await Promise.all([
        fetchProductCatalog().catch(() => []),
        api<{ customers: CustomerOption[] }>("/customers").catch(() => ({ customers: [] })),
      ]);
      setProducts(Array.isArray(prodRes) ? prodRes : []);
      setCustomers(custRes.customers || []);
    } catch (e) {
      console.error("Failed to load POS data from server:", e);
      showToast("Could not load products or customers.", "error");
    } finally {
      setLoading(false);
    }
  }, [businessId, showToast]);

  useEffect(() => {
    resetCheckoutState();
    void loadData();
  }, [businessId, loadData, resetCheckoutState]);


  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === "all" || p.category?.toLowerCase() === selectedCategory.toLowerCase();
      if (!matchesCategory) return false;

      if (!q) return true;
      const name = (p.name || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      return name.includes(q) || barcode.includes(q) || sku.includes(q) || cat.includes(q);
    });
  }, [products, searchQuery, selectedCategory]);

  // Reset catalog pagination to page 1 on search or category filter change
  useEffect(() => {
    setCatalogPage(1);
  }, [searchQuery, selectedCategory]);

  const paginatedCatalogProducts = useMemo(() => {
    const start = (catalogPage - 1) * catalogPageSize;
    return filteredProducts.slice(start, start + catalogPageSize);
  }, [filteredProducts, catalogPage, catalogPageSize]);

  // Add to cart
  const addToCart = (product: Product) => {
    const currentStock = Number(product.stock || 0);
    const existing = cart.find((item) => item.product.id === product.id);

    if (existing) {
      if (currentStock > 0 && existing.quantity >= currentStock) {
        showToast(`Cannot add more. Only ${currentStock} in stock.`, "info");
        return;
      }
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      if (currentStock === 0) {
        showToast(`${product.name} is currently out of stock.`, "info");
      }
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          discountType: product.discountType || "none",
          discountValue: Number(product.discountValue || 0),
        },
      ]);
    }
  };

  const updateItemDiscount = (productId: number, discountType: "none" | "fixed" | "percentage", discountValue: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, discountType, discountValue: Math.max(0, discountValue) }
          : item
      )
    );
  };

  const updateCartQty = (productId: number, newQty: number) => {
    const target = cart.find((i) => i.product.id === productId);
    if (!target) return;

    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    const currentStock = Number(target.product.stock || 0);
    if (currentStock > 0 && newQty > currentStock) {
      showToast(`Cannot exceed available stock of ${currentStock}.`, "info");
      newQty = currentStock;
    }

    setCart(
      cart.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountType("none");
    setDiscountValue("0");
    setCashTendered("");
  };

  // Barcode quick-scanner listener on search input (Enter key)
  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      e.preventDefault();
      const code = searchQuery.trim().toLowerCase();
      const match = products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === code) ||
          (p.sku && p.sku.toLowerCase() === code)
      );
      if (match) {
        addToCart(match);
        setSearchQuery("");
        showToast(`Added ${match.name} to bill`, "success");
      }
    }
  };

  // Camera Barcode Scanner handler
  const handleCameraScan = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    const match = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase() === trimmed.toLowerCase()) ||
        String(p.id) === trimmed
    );

    if (match) {
      addToCart(match);
      setScannerLastScanned({
        code: trimmed,
        productName: match.name,
        price: Number(match.sellingPrice ?? match.price ?? 0),
        found: true,
      });
      showToast(`${match.name} ${t("scanner.added_success", "added to bill")}`, "success");
    } else {
      setScannerLastScanned({
        code: trimmed,
        productName: t("scanner.not_found", "Product not found"),
        found: false,
      });
      showToast(`Barcode "${trimmed}" not found in inventory`, "info");
    }
  };

  // Calculations
  const grossSubtotal = useMemo(() => {
    return cart.reduce((acc, curr) => {
      const price = Number(curr.product.sellingPrice ?? curr.product.price ?? 0);
      return acc + price * curr.quantity;
    }, 0);
  }, [cart]);

  const itemDiscountsTotal = useMemo(() => {
    if (activeBusiness?.allowDiscounts === false) return 0;
    return cart.reduce((acc, curr) => {
      const price = Number(curr.product.sellingPrice ?? curr.product.price ?? 0);
      const discType = curr.discountType || "none";
      const discVal = Number(curr.discountValue || 0);
      const lineGross = price * curr.quantity;

      if (discType === "fixed" && discVal > 0) {
        return acc + Math.min(lineGross, discVal * curr.quantity);
      }
      if (discType === "percentage" && discVal > 0) {
        const pct = Math.min(100, Math.max(0, discVal));
        return acc + Math.round(lineGross * (pct / 100));
      }
      return acc;
    }, 0);
  }, [cart, activeBusiness?.allowDiscounts]);

  const netAfterItemDiscounts = useMemo(() => {
    return Math.max(0, grossSubtotal - itemDiscountsTotal);
  }, [grossSubtotal, itemDiscountsTotal]);

  const cartDiscountAmount = useMemo(() => {
    if (activeBusiness?.allowDiscounts === false) return 0;
    const val = Number(parseCurrencyInput(discountValue)) || 0;
    if (discountType === "fixed") {
      return Math.min(netAfterItemDiscounts, Math.max(0, val));
    }
    if (discountType === "percentage") {
      const pct = Math.min(100, Math.max(0, val));
      return Math.round((netAfterItemDiscounts * pct) / 100);
    }
    return 0;
  }, [netAfterItemDiscounts, discountType, discountValue, activeBusiness?.allowDiscounts]);

  const totalDiscount = useMemo(() => {
    return itemDiscountsTotal + cartDiscountAmount;
  }, [itemDiscountsTotal, cartDiscountAmount]);

  const grandTotal = useMemo(() => {
    return Math.max(0, grossSubtotal - totalDiscount);
  }, [grossSubtotal, totalDiscount]);

  const cashTenderedAmount = useMemo(
    () => Number(parseCurrencyInput(cashTendered)) || 0,
    [cashTendered],
  );

  const isCashTenderSufficient = useMemo(() => {
    if (paymentMethod !== "cash") return true;
    return cashTenderedAmount >= grandTotal;
  }, [cashTenderedAmount, grandTotal, paymentMethod]);

  const changeDue = useMemo(() => {
    if (paymentMethod !== "cash") return 0;
    return Math.max(0, cashTenderedAmount - grandTotal);
  }, [cashTenderedAmount, grandTotal, paymentMethod]);

  useEffect(() => {
    if (paymentMethod !== "cash" || cart.length === 0) return;
    setCashTendered((prev) => {
      if (prev.trim() === "") return String(grandTotal);
      const prevAmount = Number(parseCurrencyInput(prev)) || 0;
      // Customer entered extra for change — keep it.
      if (prevAmount >= grandTotal) return prev;
      // Bill grew (more qty / discounts changed) — default to exact total due.
      return String(grandTotal);
    });
  }, [paymentMethod, cart.length, grandTotal]);

  // Checkout
  const handleCheckout = async () => {
    if (checkoutLockRef.current) return;
    checkoutLockRef.current = true;
    setCheckingOut(true);

    try {
      if (cart.length === 0) {
        showToast("Cart is empty. Add products to create a bill.", "error");
        return;
      }

      if (paymentMethod === "cash" && cashTenderedAmount < grandTotal) {
        showToast(
          `Cash received must be at least ₨ ${grandTotal.toLocaleString()} (currently ₨ ${cashTenderedAmount.toLocaleString()}).`,
          "error",
        );
        return;
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
        items: cart.map((i) => ({
          productId: i.product.id,
          barcode: i.product.barcode || undefined,
          quantity: i.quantity,
          discountType: activeBusiness?.allowDiscounts === false ? "none" : (i.discountType || "none"),
          discountValue: activeBusiness?.allowDiscounts === false ? 0 : Number(i.discountValue || 0),
        })),
        customerName,
        customerMobile: customerMobile || undefined,
        discountType: activeBusiness?.allowDiscounts === false ? "none" : discountType,
        discountValue: activeBusiness?.allowDiscounts === false ? 0 : (Number(parseCurrencyInput(discountValue)) || 0),
        paymentMethod,
      };

      const receiptObjItems = cart.map((i) => {
        const rate = Number(i.product.sellingPrice ?? i.product.price ?? 0);
        const discType = i.discountType || "none";
        const discVal = Number(i.discountValue || 0);
        let itemDiscount = 0;
        if (discType === "fixed" && discVal > 0) {
          itemDiscount = Math.min(rate * i.quantity, discVal * i.quantity);
        } else if (discType === "percentage" && discVal > 0) {
          itemDiscount = Math.round((rate * i.quantity) * (discVal / 100));
        }
        return {
          name: i.product.name,
          quantity: i.quantity,
          price: rate,
          total: (rate * i.quantity) - itemDiscount,
          discountAmount: itemDiscount,
          discountType: discType,
          discountValue: discVal,
        };
      });

      const res = await api<{
        id: number;
        invoiceNumber: string;
        createdAt: string;
        totalAmount: number;
        subtotal: number;
      }>("/sales/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const receiptObj: DetailedSaleReceipt = {
        id: res.id,
        invoiceNumber: res.invoiceNumber || `ALM-${res.id}`,
        createdAt: res.createdAt || new Date().toISOString(),
        customerName,
        customerMobile,
        items: receiptObjItems,
        subtotal: grossSubtotal,
        discountAmount: totalDiscount,
        discountType,
        totalAmount: res.totalAmount ?? grandTotal,
        paymentMethod,
        cashTendered: paymentMethod === "cash" ? cashTenderedAmount : undefined,
        changeDue: paymentMethod === "cash" ? changeDue : undefined,
      };

      setReceipt(receiptObj);
      clearCart();
      showToast(`Bill #${receiptObj.invoiceNumber} completed successfully!`, "success");

      logActivity(
        "SALE_CREATE",
        "Sales",
        `Created POS sale #${receiptObj.invoiceNumber} (${receiptObj.items.length} items, ₨ ${grandTotal.toLocaleString()})`,
        receiptObj.invoiceNumber,
        { invoiceNumber: receiptObj.invoiceNumber, totalAmount: grandTotal, paymentMethod }
      );

      // Refresh product stock list directly from DB
      void loadData();

      if (onSaleCompleted) {
        onSaleCompleted();
      }
    } catch (err: any) {
      console.error("POS Checkout error:", err);
      showToast(err.message || "Failed to complete checkout.", "error");
    } finally {
      checkoutLockRef.current = false;
      setCheckingOut(false);
    }
  };

  const unitsInCart = cart.reduce((sum, item) => sum + item.quantity, 0);
  const fieldCls =
    "w-full h-10 px-3 rounded-[9px] bg-[var(--surface)] border border-[var(--border)] text-[13.5px] text-[var(--text)] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--ring)]";

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ================= Catalog ================= */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-4 min-w-0">
          {/* Search, barcode & camera */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--brand)]">
                  <Icon name="scan" size={19} />
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={t("pos.scanner_input", "Scan Barcode or Search by product name, SKU...")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  aria-label={t("pos.scanner_input", "Scan barcode or search product")}
                  className="w-full h-12 pl-11 pr-20 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[15px] text-[var(--text)] shadow-[var(--shadow-xs)] outline-none transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--ring)] max-sm:text-[16px]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-2 my-auto h-8 min-h-8 px-2.5 rounded-lg flex items-center gap-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                  >
                    <Icon name="x" size={13} />
                    Clear
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="h-12 min-h-12 flex items-center gap-2 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[13.5px] font-medium shadow-[var(--shadow-xs)] shrink-0 transition-colors hover:border-[var(--brand-line)] hover:text-[var(--brand)] cursor-pointer active:scale-[0.98]"
                title={t("pos.scan_camera_tip", "Scan barcode with mobile camera or webcam")}
                aria-label={t("pos.scan_camera", "Camera Scanner")}
              >
                <Icon name="camera" size={18} />
                <span className="hidden sm:inline">{t("pos.scan_camera", "Camera Scanner")}</span>
              </button>
            </div>

            {/* Category chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Categories">
              {[{ key: "all", label: `${t("nav.all_products", "All Items")}`, count: products.length }, ...categories.map((cat) => ({
                key: cat,
                label: cat,
                count: products.filter((p) => p.category === cat).length,
              }))].map((c) => {
                const on = selectedCategory === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setSelectedCategory(c.key)}
                    className={`h-8 min-h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors shrink-0 capitalize cursor-pointer flex items-center gap-1.5 ${
                      on
                        ? "bg-[var(--text)] border-[var(--text)] text-[var(--surface)]"
                        : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                    }`}
                  >
                    {c.label}
                    <span className={`tabular-nums text-[11px] ${on ? "opacity-60" : "text-[var(--muted)]"}`}>{c.count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3" aria-busy="true" aria-label="Loading inventory catalog">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 flex flex-col gap-2.5">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-14 px-6 text-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)] flex flex-col items-center gap-2 al-page-enter">
              <span className="size-11 rounded-xl grid place-items-center bg-[var(--surface)] text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--border)]">
                <Icon name="box" size={20} />
              </span>
              <p className="m-0 mt-1 text-sm font-medium text-[var(--text)]">No matching products found</p>
              <p className="m-0 text-[13px] text-[var(--muted)]">Try searching for another product name, SKU or barcode.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 al-stagger">
                {paginatedCatalogProducts.map((p) => {
                  const price = Number(p.sellingPrice ?? p.price ?? 0);
                  const stock = Number(p.stock || 0);
                  const low = stock <= Number(p.lowStockThreshold || 5);
                  const isOutOfStock = stock <= 0;
                  const thumbUrl = resolveImageUrl(p.imageUrl);
                  const inCart = cart.find((item) => item.product.id === p.id)?.quantity ?? 0;
                  const initials = (p.name || "?").split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className={`group relative text-left rounded-xl border bg-[var(--surface)] overflow-hidden flex flex-col transition-[border-color,box-shadow,transform] duration-150 cursor-pointer active:scale-[0.98] ${
                        inCart > 0
                          ? "border-[var(--brand-line)] shadow-[0_0_0_3px_var(--ring)]"
                          : "border-[var(--border)] shadow-[var(--shadow-xs)] hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)]"
                      } ${isOutOfStock ? "opacity-70" : ""}`}
                    >
                      <div className="relative h-[76px] w-full overflow-hidden border-b border-[var(--border)] bg-[radial-gradient(120%_90%_at_15%_0%,var(--brand-soft),transparent_70%),var(--surface-2)] flex items-end">
                        {thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        ) : (
                          <span className="pl-3 pb-2 text-[20px] font-semibold tracking-[-0.04em] text-[var(--brand)] opacity-80" aria-hidden>
                            {initials}
                          </span>
                        )}
                        {inCart > 0 && (
                          <span className="absolute top-2 right-2 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[var(--brand)] text-[var(--on-brand)] text-[11.5px] font-semibold grid place-items-center tabular-nums al-pop">
                            {inCart}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5 p-3 flex-1">
                        <span className="text-[11px] text-[var(--muted)] truncate capitalize">{p.category || "General"}</span>
                        <strong className="block text-[13px] font-medium text-[var(--text)] line-clamp-2 leading-snug min-h-[34px]">{p.name}</strong>
                        <div className="mt-auto pt-1 flex items-end justify-between gap-2">
                          {p.discountType && p.discountType !== "none" && Number(p.discountValue || 0) > 0 ? (
                            <div className="min-w-0">
                              <span className="block text-[11px] line-through text-[var(--faint)] tabular-nums">₨ {price.toLocaleString()}</span>
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[14px] font-semibold text-[var(--text)] tabular-nums">
                                  ₨{" "}
                                  {Math.max(
                                    0,
                                    p.discountType === "percentage"
                                      ? Math.round(price * (1 - Number(p.discountValue) / 100))
                                      : price - Number(p.discountValue)
                                  ).toLocaleString()}
                                </span>
                                <span className="text-[10.5px] font-medium px-1.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                                  {p.discountType === "percentage" ? `-${p.discountValue}%` : `-₨${p.discountValue}`}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-[14px] font-semibold text-[var(--text)] tabular-nums">₨ {price.toLocaleString()}</span>
                          )}
                          <span
                            className={`shrink-0 text-[11px] tabular-nums ${
                              isOutOfStock ? "text-[var(--neg)]" : low ? "text-[var(--warn)]" : "text-[var(--muted)]"
                            }`}
                          >
                            {isOutOfStock ? "Out of Stock" : `${stock} in stock`}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredProducts.length > 0 && (
                <PaginationControls
                  currentPage={catalogPage}
                  totalItems={filteredProducts.length}
                  pageSize={catalogPageSize}
                  onPageChange={setCatalogPage}
                  onPageSizeChange={(newSize) => {
                    setCatalogPageSize(newSize);
                    setCatalogPage(1);
                  }}
                  pageSizeOptions={[6, 9, 12, 18, 24, 36]}
                  itemLabel={t("term.products", "products")}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)]"
                />
              )}
            </>
          )}
        </div>

        {/* ================= Bill ================= */}
        <aside
          id="pos-bill"
          className="lg:col-span-5 xl:col-span-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)] overflow-hidden lg:sticky lg:top-[76px] lg:max-h-[max(560px,calc(100vh-236px))] flex flex-col scroll-mt-20"
          aria-label={t("pos.cart", "Customer Bill")}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3.5 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <div className="min-w-0">
              <h3 className="m-0 text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">{t("pos.cart", "Customer Bill")}</h3>
              <p className="m-0 text-[12px] text-[var(--muted)] tabular-nums">
                {cart.length} unique {cart.length === 1 ? "item" : "items"} · {unitsInCart} units
              </p>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="h-8 min-h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--neg)] hover:bg-[var(--neg-soft)] cursor-pointer"
              >
                <Icon name="trash" size={14} />
                {t("pos.clear_cart", "Clear Bill")}
              </button>
            )}
          </div>

          {/* Cart lines */}
          <div className="max-h-[300px] lg:max-h-none lg:flex-1 lg:min-h-[140px] overflow-y-auto">
            {cart.length === 0 ? (
              <div className="py-10 px-6 text-center flex flex-col items-center gap-1.5">
                <span className="size-10 rounded-xl grid place-items-center bg-[var(--surface-2)] text-[var(--muted)] shadow-[inset_0_0_0_1px_var(--border)]">
                  <Icon name="cart" size={19} />
                </span>
                <p className="m-0 mt-1 text-[13.5px] font-medium text-[var(--text)]">Cart is empty</p>
                <p className="m-0 text-[12.5px] text-[var(--muted)]">Click items on the left or scan barcode to add</p>
              </div>
            ) : (
              cart.map((item) => {
                const rate = Number(item.product.sellingPrice ?? item.product.price ?? 0);
                const max = Number(item.product.stock || 0);
                const hasDiscount = item.discountType && item.discountType !== "none" && Number(item.discountValue || 0) > 0;
                let unitDiscount = 0;
                if (hasDiscount) {
                  if (item.discountType === "percentage") {
                    unitDiscount = Math.round(rate * (Number(item.discountValue) / 100));
                  } else {
                    unitDiscount = Math.min(rate, Number(item.discountValue));
                  }
                }
                const netRate = Math.max(0, rate - unitDiscount);
                const lineTotal = netRate * item.quantity;
                const isEditingDiscount = editingDiscountProductId === item.product.id;

                return (
                  <div key={item.product.id} className="px-4 py-3 border-b border-[var(--border)] last:border-b-0 al-page-enter">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <strong className="block text-[13.5px] font-medium text-[var(--text)] truncate">{item.product.name}</strong>
                          {hasDiscount && (
                            <span className="shrink-0 text-[10.5px] font-medium px-1.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
                              {item.discountType === "percentage" ? `${item.discountValue}% Off` : `-₨${item.discountValue}`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] tabular-nums">
                          {hasDiscount ? (
                            <>
                              <span className="line-through text-[var(--faint)]">₨ {rate.toLocaleString()}</span>
                              <span className="text-[var(--brand)]">₨ {netRate.toLocaleString()} each</span>
                            </>
                          ) : (
                            <span className="text-[var(--muted)]">₨ {rate.toLocaleString()} each</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center h-8 rounded-[9px] border border-[var(--border)] bg-[var(--surface)] shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                          aria-label={`Decrease ${item.product.name}`}
                          className="size-8 min-h-8 grid place-items-center rounded-l-[9px] text-[var(--text-2)] hover:bg-[var(--surface-2)] cursor-pointer"
                        >
                          <Icon name="minus" size={14} strokeWidth={2} />
                        </button>
                        <span className="w-7 text-center text-[13px] font-semibold text-[var(--text)] tabular-nums">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                          disabled={max > 0 && item.quantity >= max}
                          aria-label={`Increase ${item.product.name}`}
                          className="size-8 min-h-8 grid place-items-center rounded-r-[9px] text-[var(--text-2)] hover:bg-[var(--surface-2)] disabled:opacity-35 cursor-pointer"
                        >
                          <Icon name="plus" size={14} strokeWidth={2} />
                        </button>
                      </div>

                      <div className="w-[76px] text-right shrink-0 tabular-nums">
                        {hasDiscount && (
                          <span className="block text-[11px] line-through text-[var(--faint)]">₨ {(rate * item.quantity).toLocaleString()}</span>
                        )}
                        <strong className="text-[13.5px] font-semibold text-[var(--text)]">₨ {lineTotal.toLocaleString()}</strong>
                      </div>
                    </div>

                    <div className="mt-1.5 flex items-center gap-1 -ml-1.5">
                      {activeBusiness?.allowDiscounts !== false && (
                        <button
                          type="button"
                          onClick={() => setEditingDiscountProductId(isEditingDiscount ? null : item.product.id)}
                          className={`h-7 min-h-7 px-1.5 rounded-md flex items-center gap-1 text-[12px] font-medium transition-colors cursor-pointer ${
                            isEditingDiscount ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--muted)] hover:text-[var(--brand)]"
                          }`}
                          title="Set discount for this product"
                        >
                          <Icon name="tag" size={13} />
                          Discount
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.product.id)}
                        className="h-7 min-h-7 px-1.5 rounded-md flex items-center gap-1 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--neg)] cursor-pointer"
                      >
                        <Icon name="x" size={13} />
                        Remove
                      </button>
                    </div>

                    {isEditingDiscount && activeBusiness?.allowDiscounts !== false && (
                      <div className="mt-2 p-2 rounded-[10px] bg-[var(--brand-soft)] border border-[var(--brand-line)] flex items-center justify-between gap-2 text-xs al-pop">
                        <span className="text-[12px] font-medium text-[var(--brand-ink)]">Item Disc:</span>
                        <div className="flex items-center gap-1.5">
                          <Select value={item.discountType || "none"} onValueChange={(v) => updateItemDiscount(item.product.id, v as "none" | "fixed" | "percentage", item.discountValue || 0)}>
                            <SelectTrigger size="sm" aria-label="Item discount type" className="w-auto gap-1.5 max-sm:min-h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="min-w-[9rem]">
                              <SelectItem value="none">No Disc</SelectItem>
                              <SelectItem value="fixed">Fixed (₨ Off)</SelectItem>
                              <SelectItem value="percentage">Percent (% Off)</SelectItem>
                            </SelectContent>
                          </Select>
                          {item.discountType !== "none" && (
                            <input
                              type="number"
                              min="0"
                              placeholder={item.discountType === "percentage" ? "10" : "50"}
                              value={item.discountValue || ""}
                              onChange={(e) => updateItemDiscount(item.product.id, item.discountType || "fixed", Number(e.target.value) || 0)}
                              className="w-16 h-8 min-h-8 text-[12px] px-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] outline-none tabular-nums"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingDiscountProductId(null)}
                            className="h-8 min-h-8 px-2.5 text-[12px] bg-[var(--brand)] hover:bg-[var(--brand-strong)] text-[var(--on-brand)] font-medium rounded-lg cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-col gap-3 px-4 py-3.5 border-t border-[var(--border)] lg:overflow-y-auto lg:shrink lg:min-h-[96px]">
            {/* Customer */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-medium text-[var(--text-2)]">Customer</span>
                <div className="inline-flex p-[3px] rounded-[9px] bg-[var(--sunken)] border border-[var(--border)] gap-0.5">
                  {(["walkin", "existing"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCustomerMode(m)}
                      className={`h-7 min-h-7 px-2.5 rounded-md text-[12px] font-medium transition-colors ${
                        customerMode === m
                          ? "bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-xs),0_0_0_1px_var(--border)]"
                          : "text-[var(--muted)] hover:text-[var(--text)]"
                      }`}
                    >
                      {m === "walkin" ? "Walk-in" : "Khata Customer"}
                    </button>
                  ))}
                </div>
              </div>

              {customerMode === "walkin" ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Customer Name (Optional)"
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    className={fieldCls}
                  />
                  <input
                    type="tel"
                    placeholder="Mobile (Optional)"
                    value={walkinMobile}
                    onChange={(e) => setWalkinMobile(e.target.value)}
                    className={fieldCls}
                  />
                </div>
              ) : (
                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                  <SelectTrigger aria-label="Existing customer" className="h-10 rounded-[9px]">
                    <SelectValue placeholder="Choose an existing customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name} ({c.mobile})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Bill discount */}
            {activeBusiness?.allowDiscounts === false ? (
              <div className="h-10 px-3 rounded-[9px] bg-[var(--surface-2)] border border-[var(--border)] text-[13px] text-[var(--muted)] flex items-center justify-between">
                <span>{t("term.discount", "Discount")}</span>
                <span className="text-[12px] flex items-center gap-1.5">
                  <Icon name="lock" size={13} />
                  Disabled by Store Owner
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Select value={discountType} onValueChange={(v) => setDiscountType(v as typeof discountType)}>
                  <SelectTrigger aria-label="Bill discount type" className="h-10 rounded-[9px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Discount</SelectItem>
                    <SelectItem value="fixed">Fixed (₨ Off)</SelectItem>
                    <SelectItem value="percentage">Percent (% Off)</SelectItem>
                  </SelectContent>
                </Select>
                {discountType !== "none" && (
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={discountType === "percentage" ? "10%" : "200"}
                    value={discountType === "fixed" ? formatCurrencyInput(discountValue) : discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className={`${fieldCls} tabular-nums al-pop`}
                    aria-label="Bill discount value"
                  />
                )}
              </div>
            )}

            {/* Payment method */}
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("pos.select_payment", "Select Payment Method")}>
              {(["cash", "online"] as const).map((m) => {
                const on = paymentMethod === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      if (m === "cash") {
                        setPaymentMethod("cash");
                        if (cart.length > 0) setCashTendered(String(grandTotal));
                      } else {
                        setPaymentMethod("online");
                      }
                    }}
                    className={`h-11 min-h-11 px-3 rounded-[10px] border text-[13.5px] font-medium flex items-center justify-center gap-2 transition-[border-color,box-shadow,color] duration-150 cursor-pointer ${
                      on
                        ? "border-[var(--brand)] text-[var(--brand)] bg-[var(--brand-soft)] shadow-[0_0_0_3px_var(--ring)]"
                        : "border-[var(--border)] text-[var(--text-2)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <Icon name={m === "cash" ? "pkr" : "card"} size={16} />
                    {m === "cash" ? t("term.cash", "Cash") : t("term.online", "Online / Bank")}
                  </button>
                );
              })}
            </div>

            {paymentMethod === "cash" && (
              <div className="grid grid-cols-2 gap-2 al-pop">
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-[var(--text-2)]">Cash Received (₨)</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder={grandTotal > 0 ? `Min ₨ ${grandTotal.toLocaleString()}` : "e.g. 5,000"}
                    value={formatCurrencyInput(cashTendered)}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className={`${fieldCls} font-medium tabular-nums ${
                      cart.length > 0 && !isCashTenderSufficient ? "!border-[var(--neg)] shadow-[0_0_0_3px_var(--neg-soft)]" : ""
                    }`}
                  />
                  {cart.length > 0 && !isCashTenderSufficient && (
                    <span className="text-[11.5px] font-medium text-[var(--neg)] tabular-nums">Need at least ₨ {grandTotal.toLocaleString()}</span>
                  )}
                </label>
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] font-medium text-[var(--text-2)]">Change Due</span>
                  <div
                    className={`h-10 px-3 rounded-[9px] border flex items-center text-[14px] font-semibold tabular-nums ${
                      changeDue > 0
                        ? "bg-[var(--brand-soft)] border-[var(--brand-line)] text-[var(--brand)]"
                        : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--muted)]"
                    }`}
                  >
                    ₨ {changeDue.toLocaleString()}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Totals + checkout (always visible) */}
          <div className="flex flex-col gap-3 px-4 pt-3 pb-4 border-t border-[var(--border)] bg-[var(--surface-2)] shrink-0">
            <div className="flex flex-col gap-1.5 text-[13px] tabular-nums">
              <div className="flex justify-between text-[var(--text-2)]">
                <span>{t("term.subtotal", "Gross Subtotal")}</span>
                <span>₨ {grossSubtotal.toLocaleString()}</span>
              </div>
              {itemDiscountsTotal > 0 && (
                <div className="flex justify-between text-[var(--pos)]">
                  <span>Product Discounts</span>
                  <span>- ₨ {itemDiscountsTotal.toLocaleString()}</span>
                </div>
              )}
              {cartDiscountAmount > 0 && (
                <div className="flex justify-between text-[var(--pos)]">
                  <span>Bill Discount ({discountType === "percentage" ? `${discountValue}%` : `Fixed`})</span>
                  <span>- ₨ {cartDiscountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between items-end pt-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)] pb-1">{t("term.total", "Total")}</span>
                <span className="text-[32px] leading-none font-semibold tracking-[-0.04em] text-[var(--text)]">
                  <AnimatedNumber value={grandTotal} duration={260} format={(n, final) => `₨ ${(final ? n : Math.round(n)).toLocaleString()}`} />
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={checkingOut || cart.length === 0 || !isCashTenderSufficient}
              className="w-full h-[52px] min-h-[52px] px-5 rounded-xl bg-[var(--brand)] hover:bg-[var(--brand-strong)] text-[var(--on-brand)] font-semibold text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,.18),0_1px_2px_rgba(10,94,72,.35)] transition-[background-color,transform,opacity] duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed active:scale-[0.99]"
            >
              {checkingOut ? (
                <>
                  <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />
                  <span>Completing Sale...</span>
                </>
              ) : (
                <>
                  <Icon name="check" size={18} strokeWidth={2.2} />
                  <span>{t("pos.complete_btn", "Complete Sale (Bill Banayein)")}</span>
                </>
              )}
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile: floating bill summary that jumps to the bill */}
      {cart.length > 0 && (
        <a
          href="#pos-bill"
          className="lg:hidden fixed left-3 right-3 bottom-[calc(86px+max(10px,env(safe-area-inset-bottom)))] z-30 h-14 px-4 rounded-2xl bg-[var(--text)] text-[var(--surface)] shadow-[var(--shadow-lg)] flex items-center gap-3 no-underline al-page-enter"
        >
          <span className="size-8 rounded-full grid place-items-center bg-[var(--brand)] text-[var(--on-brand)] text-[13px] font-semibold tabular-nums">{unitsInCart}</span>
          <span className="flex-1 text-[14px] font-medium">View bill</span>
          <span className="text-[16px] font-semibold tabular-nums">₨ {grandTotal.toLocaleString()}</span>
          <Icon name="right" size={16} />
        </a>
      )}

      {/* Post-Sale Receipt Modal */}
      {receipt && (
        <PosReceiptModal
          receipt={receipt}
          onClose={() => setReceipt(null)}
          onNewSale={() => setReceipt(null)}
        />
      )}

      {/* Camera Barcode & QR Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleCameraScan}
        continuous={true}
        lastScannedInfo={scannerLastScanned}
        title={t("scanner.title", "Camera Barcode & QR Scanner")}
        subtitle={t("scanner.subtitle", "Point camera at any product barcode to instantly add to bill")}
      />
    </>
  );
}
