"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { api, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { logActivity } from "@/app/lib/logger";
import { DetailedSaleReceipt, PosReceiptModal } from "@/app/components/pos-receipt-modal";
import { formatCurrencyInput, parseCurrencyInput } from "@/app/lib/validators";

interface PosCartItem {
  product: Product;
  quantity: number;
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

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Cart
  const [cart, setCart] = useState<PosCartItem[]>([]);

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
  const [cashTendered, setCashTendered] = useState<string>("0");

  // Submit & Receipt
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<DetailedSaleReceipt | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch products and customers
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, custRes] = await Promise.all([
        api<Product[]>("/products").catch(() => []),
        api<{ customers: CustomerOption[] }>("/customers").catch(() => ({ customers: [] })),
      ]);
      setProducts(Array.isArray(prodRes) ? prodRes : []);
      setCustomers(custRes.customers || []);
    } catch (e) {
      console.error("Failed to load POS data:", e);
    } finally {
      setLoading(false);
    }
  }, [activeBusiness?.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      setCart([...cart, { product, quantity: 1 }]);
    }
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
    setCashTendered("0");
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

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, curr) => {
      const price = Number(curr.product.sellingPrice ?? curr.product.price ?? 0);
      return acc + price * curr.quantity;
    }, 0);
  }, [cart]);

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

  // Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      showToast("Cart is empty. Add products to create a bill.", "error");
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
      })),
      customerName,
      customerMobile: customerMobile || undefined,
      discountType,
      discountValue: Number(parseCurrencyInput(discountValue)) || 0,
      paymentMethod,
    };

    setCheckingOut(true);
    try {
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
        items: cart.map((i) => {
          const rate = Number(i.product.sellingPrice ?? i.product.price ?? 0);
          return {
            name: i.product.name,
            quantity: i.quantity,
            price: rate,
            total: rate * i.quantity,
          };
        }),
        subtotal,
        discountAmount,
        discountType,
        totalAmount: res.totalAmount ?? grandTotal,
        paymentMethod,
        cashTendered: Number(parseCurrencyInput(cashTendered)) || undefined,
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

      // Refresh product stock list
      void loadData();

      if (onSaleCompleted) {
        onSaleCompleted();
      }
    } catch (err: any) {
      console.error("POS Checkout error:", err);
      showToast(err.message || "Failed to complete checkout.", "error");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Product Search, Categories & Catalog Grid (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Barcode Input */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                🔍
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Scan Barcode or Search by product name, SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-bold text-slate-900 outline-none focus:bg-white focus:border-[#00875a] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer ${
                  selectedCategory === "all"
                    ? "bg-[#00875a] text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                }`}
              >
                All Items ({products.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl transition shrink-0 capitalize cursor-pointer ${
                    selectedCategory === cat
                      ? "bg-[#00875a] text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="p-12 text-center text-xs font-bold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              Loading inventory catalog...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/80 space-y-2">
              <span className="text-3xl">📦</span>
              <p className="text-sm font-extrabold text-slate-800">No matching products found</p>
              <p className="text-xs text-slate-500 font-medium">
                Try searching for another product name, SKU or barcode.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const price = Number(p.sellingPrice ?? p.price ?? 0);
                const stock = Number(p.stock || 0);
                const low = stock <= Number(p.lowStockThreshold || 5);
                const isOutOfStock = stock <= 0;

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-[#00875a] hover:shadow-md text-left transition group cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-[10px] font-bold text-slate-400 truncate uppercase">
                          {p.category || "General"}
                        </span>
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                            isOutOfStock
                              ? "bg-red-100 text-red-700"
                              : low
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-50 text-[#00875a]"
                          }`}
                        >
                          {isOutOfStock ? "Out of Stock" : `${stock} in stock`}
                        </span>
                      </div>
                      <strong className="block text-xs font-extrabold text-slate-900 group-hover:text-[#00875a] transition line-clamp-2 leading-snug">
                        {p.name}
                      </strong>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">
                        ₨ {price.toLocaleString()}
                      </span>
                      <span className="size-6 rounded-lg bg-emerald-50 group-hover:bg-[#00875a] text-[#00875a] group-hover:text-white flex items-center justify-center text-xs font-black transition">
                        +
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Running Cart, Customer & Checkout (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200/80 shadow-md p-5 space-y-4 sticky top-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>🛒</span> Customer Bill
              </h3>
              <p className="text-[11px] font-medium text-slate-400">
                {cart.length} unique {cart.length === 1 ? "item" : "items"}
              </p>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="py-10 text-center text-slate-400 space-y-1">
                <span className="text-2xl">🛍️</span>
                <p className="text-xs font-bold">Cart is empty</p>
                <p className="text-[11px]">Click items on the left or scan barcode to add</p>
              </div>
            ) : (
              cart.map((item) => {
                const rate = Number(item.product.sellingPrice ?? item.product.price ?? 0);
                const lineTotal = rate * item.quantity;
                const max = Number(item.product.stock || 0);

                return (
                  <div
                    key={item.product.id}
                    className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <strong className="block text-xs font-bold text-slate-900 truncate">
                        {item.product.name}
                      </strong>
                      <span className="text-[10px] text-slate-500">
                        ₨ {rate.toLocaleString()} each
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                        className="size-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold text-xs"
                      >
                        -
                      </button>
                      <span className="w-7 text-center text-xs font-black text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                        disabled={max > 0 && item.quantity >= max}
                        className="size-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-bold text-xs disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-20 text-right shrink-0">
                      <strong className="text-xs font-black text-slate-900">
                        ₨ {lineTotal.toLocaleString()}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      className="size-6 text-red-500 hover:bg-red-50 rounded grid place-items-center text-xs font-bold shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Customer Selection */}
          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-700">Customer:</span>
              <div className="flex gap-1 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setCustomerMode("walkin")}
                  className={`px-2 py-0.5 rounded-md ${
                    customerMode === "walkin" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                >
                  Walk-in
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode("existing")}
                  className={`px-2 py-0.5 rounded-md ${
                    customerMode === "existing" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                >
                  Khata Customer
                </button>
              </div>
            </div>

            {customerMode === "walkin" ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Customer Name (Optional)"
                  value={walkinName}
                  onChange={(e) => setWalkinName(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none"
                />
                <input
                  type="tel"
                  placeholder="Mobile (Optional)"
                  value={walkinMobile}
                  onChange={(e) => setWalkinMobile(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            ) : (
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none"
              >
                <option value="">-- Choose Existing Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.mobile})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Discount & Payment Method */}
          <div className="space-y-2 text-xs">
            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                className="w-1/2 px-2 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700 outline-none"
              >
                <option value="none">No Discount</option>
                <option value="fixed">Fixed (₨ Off)</option>
                <option value="percentage">Percent (% Off)</option>
              </select>
              {discountType !== "none" && (
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={discountType === "percentage" ? "10%" : "200"}
                  value={discountType === "fixed" ? formatCurrencyInput(discountValue) : discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-black text-slate-900 outline-none"
                />
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                  paymentMethod === "cash"
                    ? "bg-[#e6f4ed] text-[#00875a] border-[#00875a]"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <span>💵</span> Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("online")}
                className={`py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                  paymentMethod === "online"
                    ? "bg-[#e6f4ed] text-[#00875a] border-[#00875a]"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <span>🏦</span> Online / Bank
              </button>
            </div>

            {paymentMethod === "cash" && (
              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-500">Cash Received (₨)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 5,000"
                    value={formatCurrencyInput(cashTendered)}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-xs font-black text-slate-900 outline-none"
                  />
                </div>
                {changeDue > 0 && (
                  <div className="text-right">
                    <span className="block text-[10px] font-bold text-slate-500">Change Due</span>
                    <strong className="text-xs font-black text-emerald-700">₨ {changeDue.toLocaleString()}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtotal & Total Bill Breakdown */}
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-1.5">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Subtotal</span>
              <span>₨ {subtotal.toLocaleString()}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs text-emerald-400">
                <span>Discount</span>
                <span>- ₨ {discountAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Total</span>
              <span className="text-xl font-black text-emerald-400">
                ₨ {grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Complete Sale CTA */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={checkingOut || cart.length === 0}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#00875a] to-[#006644] hover:from-[#00744e] hover:to-[#005236] text-white font-black text-sm sm:text-base shadow-lg shadow-[#00875a]/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            {checkingOut ? (
              <span>Completing Sale...</span>
            ) : (
              <>
                <span>Complete Sale (Bill Banayein)</span>
                <span className="text-lg">➔</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Post-Sale Receipt Modal */}
      {receipt && (
        <PosReceiptModal
          receipt={receipt}
          onClose={() => setReceipt(null)}
          onNewSale={() => setReceipt(null)}
        />
      )}
    </>
  );
}
