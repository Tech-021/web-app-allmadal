"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import ui from "@/app/components/workspace-ui.module.css";

const money = (n: number) => `Rs ${Number(n).toLocaleString()}`;

function ProductAvatar({ name }: { name: string }) {
  const initial = name[0]?.toUpperCase() || "P";
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: "#e6f4ed",
        color: "#00875a",
        fontWeight: 800,
        fontSize: 14,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

export default function StockPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "low" | "out">("all");
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Modal form states
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setProducts(await api<Product[]>("/products"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load products.";
      showToast(msg, "error");
    }
  }, [showToast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // Compute stat totals
  const stats = useMemo(() => {
    const totalProducts = products.length;
    const totalItems = products.reduce((acc, p) => acc + Number(p.stock ?? 0), 0);
    const lowStock = products.filter(
      (p) => Number(p.stock ?? 0) > 0 && Number(p.stock ?? 0) <= Number(p.lowStockThreshold ?? 5)
    ).length;
    const outOfStock = products.filter((p) => Number(p.stock ?? 0) === 0).length;

    return { totalProducts, totalItems, lowStock, outOfStock };
  }, [products]);

  // Filter products by tab & search query
  const displayedProducts = useMemo(() => {
    let result = products;
    if (activeTab === "low") {
      result = result.filter(
        (p) => Number(p.stock ?? 0) > 0 && Number(p.stock ?? 0) <= Number(p.lowStockThreshold ?? 5)
      );
    } else if (activeTab === "out") {
      result = result.filter((p) => Number(p.stock ?? 0) === 0);
    }

    const q = query.toLowerCase().trim();
    if (q) {
      result = result.filter((p) =>
        [p.name, p.barcode, p.sku, p.category].some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        )
      );
    }

    return result;
  }, [products, activeTab, query]);

  const selectedProduct = products.find((p) => p.barcode === barcode);

  const autocompleteMatches = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q
      ? products
          .filter((p) =>
            [p.name, p.barcode, p.sku].some((v) =>
              String(v ?? "").toLowerCase().includes(q)
            )
          )
          .slice(0, 6)
      : [];
  }, [products, search]);

  async function handleAddStock(e: FormEvent) {
    e.preventDefault();
    if (!barcode || Number(quantity) < 1) {
      setError("Choose a product and enter a quantity of at least 1.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await api<Product>("/stock/add", {
        method: "POST",
        body: JSON.stringify({ barcode, quantity, note }),
      });
      const msg = `${updated.name} stock updated to ${updated.stock} units.`;
      showToast(msg, "success");
      setQuantity("1");
      setNote("");
      setSearch("");
      setBarcode("");
      setModalOpen(false);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not add stock.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceShell>
      {/* Header */}
      <div className={ui.head}>
        <div>
          <label>Inventory</label>
          <h1>Stock Management</h1>
          <p>Monitor stock counts, track low inventory alerts, and update store stock.</p>
        </div>
        <button
          className={ui.primary}
          onClick={() => {
            setModalOpen(true);
            setError("");
          }}
        >
          ＋ Stock Update Karein
        </button>
      </div>

      {/* 4 Stat Summary Grid - Responsive 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-gray-500 font-bold block">Total Products</span>
          <strong className="text-xl sm:text-2xl font-extrabold text-[#00875a] mt-1 block">
            {stats.totalProducts}
          </strong>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-gray-500 font-bold block">Total Stock Items</span>
          <strong className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-1 block">
            {stats.totalItems.toLocaleString()}
          </strong>
        </div>

        <div className="bg-[#fff3eb] border border-[#ffedd5] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#c2410c] font-bold block">Low Stock</span>
          <strong className="text-xl sm:text-2xl font-extrabold text-[#d97706] mt-1 block">
            {stats.lowStock}
          </strong>
          <small className="text-[10px] text-[#ea580c] font-semibold block mt-0.5">Needs reorder</small>
        </div>

        <div className="bg-[#fef2f2] border border-[#fecaca] rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-[#991b1b] font-bold block">Out of Stock</span>
          <strong className="text-xl sm:text-2xl font-extrabold text-[#dc2626] mt-1 block">
            {stats.outOfStock}
          </strong>
          <small className="text-[10px] text-[#b91c1c] font-semibold block mt-0.5">Zero stock</small>
        </div>
      </div>

      {/* Responsive Inline Split View (Product Selection + Quick Add Form) */}
      <div className={`${ui.grid} mb-6`}>
        <section className={ui.panel}>
          <h2 className="text-base font-extrabold text-gray-900 mb-3">Choose Product</h2>
          <div className={ui.field}>
            <label className="text-xs font-bold text-gray-700">Search Product Name or Barcode</label>
            <input
              className={ui.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type product name or barcode…"
            />
          </div>

          {autocompleteMatches.length > 0 && (
            <div className="mt-3 border border-gray-200 rounded-2xl overflow-hidden bg-white">
              {autocompleteMatches.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setBarcode(p.barcode);
                    setSearch(p.name);
                  }}
                  className={`flex w-full items-center justify-between p-3 text-left border-b border-gray-100 transition ${
                    p.barcode === barcode ? "bg-[#e6f4ed]" : "bg-white hover:bg-gray-50"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <strong className={`text-xs block truncate ${p.barcode === barcode ? "text-[#006b3f]" : "text-gray-900"}`}>
                      {p.name}
                    </strong>
                    <small className="text-[10px] text-gray-500 block mt-0.5">
                      {p.barcode} {p.sku ? `· ${p.sku}` : ""}
                    </small>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${p.stock <= p.lowStockThreshold ? "text-[#d97706]" : "text-[#059669]"}`}>
                    {p.stock} in stock
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className={`${ui.field} mt-4`}>
            <label className="text-xs font-bold text-gray-700">Or enter barcode directly</label>
            <div className="flex gap-2">
              <input
                className={ui.input}
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Product barcode"
              />
              <button
                className={ui.secondary}
                type="button"
                onClick={() =>
                  setSearch(products.find((p) => p.barcode === barcode)?.name ?? barcode)
                }
              >
                Find
              </button>
            </div>
          </div>
        </section>

        <form className={ui.panel} onSubmit={handleAddStock}>
          <h2 className="text-base font-extrabold text-gray-900 mb-3">Stock Intake Details</h2>

          {selectedProduct ? (
            <div className="p-3.5 rounded-2xl bg-[#e6f4ed] border border-[#c3e9d7] text-xs font-medium text-[#006b3f] mb-4">
              <strong className="text-sm font-extrabold block text-gray-900">{selectedProduct.name}</strong>
              Current stock: <strong className="text-[#00875a]">{selectedProduct.stock} units</strong>
            </div>
          ) : (
            <p className="text-xs text-gray-400 font-medium mb-4">Select a product from left to continue.</p>
          )}

          <div className={ui.field}>
            <label className="text-xs font-bold text-gray-700">Quantity to add</label>
            <input
              className={ui.input}
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className={`${ui.field} mt-3`}>
            <label className="text-xs font-bold text-gray-700">Note / Reason (optional)</label>
            <input
              className={ui.input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Supplier invoice, restock, etc."
            />
          </div>

          <button
            className={`${ui.primary} w-full mt-5 h-12 text-xs font-extrabold`}
            disabled={saving || !selectedProduct}
          >
            {saving ? "Saving…" : "Stock Update Karein"}
          </button>
        </form>
      </div>

      {/* Tabs Filter Bar matching Screen 6 */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
        {(
          [
            ["all", "Stock List"],
            ["low", `Low Stock (${stats.lowStock})`],
            ["out", `Out of Stock (${stats.outOfStock})`],
          ] as const
        ).map(([tabKey, tabLabel]) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={`px-4 py-2 rounded-full text-xs font-extrabold transition whitespace-nowrap ${
              activeTab === tabKey
                ? "bg-[#e6f4ed] text-[#006b3f] border border-[#00875a]"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {tabLabel}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className={ui.toolbar}>
        <input
          className={`${ui.input} ${ui.search}`}
          placeholder="Filter inventory list by name, barcode, or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className={ui.secondary} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {/* Product Stock Table */}
      <section className={ui.panel}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Barcode / SKU</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock Quantity</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {displayedProducts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <ProductAvatar name={p.name} />
                      <div>
                        <strong className="text-xs font-extrabold text-gray-900 block">{p.name}</strong>
                        <span className="text-[11px] text-gray-500 font-medium block">
                          Stock: {p.stock}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="text-xs font-semibold">{p.barcode}</span>
                    <br />
                    <span className={ui.muted}>{p.sku || "No SKU"}</span>
                  </td>
                  <td>
                    {p.category ? <span className={ui.badge}>{p.category}</span> : "—"}
                  </td>
                  <td>
                    <strong className="text-xs font-extrabold text-[#00875a]">
                      {money(p.sellingPrice || p.price)}
                    </strong>
                  </td>
                  <td>
                    <strong className="text-xs font-extrabold">{p.stock} units</strong>
                  </td>
                  <td>
                    {Number(p.stock) === 0 ? (
                      <span className={ui.outOfStock}>● Out of Stock</span>
                    ) : Number(p.stock) <= Number(p.lowStockThreshold ?? 5) ? (
                      <span className={ui.lowStock}>● Low Stock</span>
                    ) : (
                      <span className={ui.healthy}>● Healthy</span>
                    )}
                  </td>
                  <td>
                    <button
                      className={ui.secondary}
                      onClick={() => {
                        setBarcode(p.barcode);
                        setSearch(p.name);
                        setModalOpen(true);
                      }}
                    >
                      + Add Stock
                    </button>
                  </td>
                </tr>
              ))}
              {!displayedProducts.length && (
                <tr>
                  <td colSpan={7} className={ui.empty}>
                    No items match the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Stock Update Modal Sheet */}
      {modalOpen && (
        <div
          className={ui.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <form className={ui.sheet} onSubmit={handleAddStock}>
            <div className={ui.sheetHead}>
              <h2>Stock Update Karein</h2>
              <button type="button" className={ui.secondary} onClick={() => setModalOpen(false)}>
                Close
              </button>
            </div>

            {error && <div className={ui.error}>{error}</div>}

            <div className={ui.formGrid}>
              <div className={`${ui.field} ${ui.span2}`}>
                <label>Search Product Name or Barcode</label>
                <input
                  className={ui.input}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type product name or scan barcode…"
                  autoFocus
                />
                {autocompleteMatches.length > 0 && (
                  <div className="border border-gray-200 rounded-2xl mt-1.5 max-h-44 overflow-y-auto bg-white shadow-lg">
                    {autocompleteMatches.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setBarcode(m.barcode);
                          setSearch(m.name);
                        }}
                        className={`flex w-full items-center justify-between p-3 text-left border-b border-gray-100 text-xs ${
                          m.barcode === barcode ? "bg-[#e6f4ed]" : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div>
                          <strong className="block text-gray-900 font-bold">{m.name}</strong>
                          <span className="text-[11px] text-gray-500 font-medium">{m.barcode}</span>
                        </div>
                        <span className="font-extrabold text-[#00875a]">{m.stock} in stock</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className={`${ui.field} ${ui.span2} bg-[#e6f4ed] p-3.5 rounded-2xl border border-[#c3e9d7]`}>
                  <span className="text-xs text-[#006b3f] font-bold block">Selected Product:</span>
                  <strong className="text-base text-gray-900 font-extrabold block">{selectedProduct.name}</strong>
                  <span className="text-xs text-gray-600 font-medium block mt-0.5">
                    Current Inventory: <strong className="text-gray-900">{selectedProduct.stock} units</strong>
                  </span>
                </div>
              )}

              <div className={ui.field}>
                <label>Quantity to Add</label>
                <input
                  className={ui.input}
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>

              <div className={ui.field}>
                <label>Note / Reason (Optional)</label>
                <input
                  className={ui.input}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Supplier intake, restock, etc."
                />
              </div>
            </div>

            <div className={ui.formActions}>
              <button type="button" className={ui.secondary} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button className={ui.primary} disabled={saving || !selectedProduct}>
                {saving ? "Updating…" : "Stock Update Karein"}
              </button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceShell>
  );
}
