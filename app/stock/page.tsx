"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, fetchProductCatalog, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { logActivity } from "@/app/lib/logger";
import { CameraBarcodeScannerModal } from "@/app/components/camera-barcode-scanner-modal";
import { PaginationControls } from "@/app/components/pagination-controls";
import ui from "@/app/components/workspace-ui.module.css";
import { Icon } from "@/app/components/icons";
import { Metric, MetricStrip, PageHeader, TableEmptyRow } from "@/app/components/page-layout";
import st from "./stock.module.css";

const money = (n: number) => `Rs ${Number(n).toLocaleString()}`;

function ProductAvatar({ name }: { name: string }) {
  const initial = name[0]?.toUpperCase() || "P";
  return <span className={ui.productThumbPlaceholder}>{initial}</span>;
}

export default function StockPage() {
  const { showToast } = useToast();
  const { activeBusiness } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | "low" | "out">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modalOpen, setModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Modal form states
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setProducts(await fetchProductCatalog());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load products.";
      showToast(msg, "error");
    }
  }, [showToast, activeBusiness?.id]);

  useEffect(() => {
    void load();
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

  // Reset pagination to page 1 on tab or query change
  useEffect(() => {
    setPage(1);
  }, [activeTab, query]);

  const paginatedStockProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return displayedProducts.slice(start, start + pageSize);
  }, [displayedProducts, page, pageSize]);

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

      logActivity(
        "STOCK_UPDATE",
        "Stock",
        `Added +${quantity} units to '${updated.name}' (New stock: ${updated.stock})${note ? ` [Note: ${note}]` : ""}`,
        updated.name,
        { barcode, quantityAdded: Number(quantity), newStock: updated.stock, note }
      );

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

  const handleBarcodeScanned = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const match = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === trimmed.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase() === trimmed.toLowerCase())
    );
    if (match) {
      setBarcode(match.barcode || trimmed);
      setSearch(match.name);
      showToast(`Selected: ${match.name}`, "success");
    } else {
      setBarcode(trimmed);
      setSearch(trimmed);
      showToast(`Scanned barcode: ${trimmed}`, "info");
    }
  };

  const productPicker = (compact: boolean) =>
    autocompleteMatches.length > 0 && (
      <div className={`${st.matches} ${compact ? st.matchesCompact : ""}`} role="listbox" aria-label="Matching products">
        {autocompleteMatches.map((p) => {
          const selected = p.barcode === barcode;
          return (
            <button
              type="button"
              key={p.id}
              role="option"
              aria-selected={selected}
              onClick={() => {
                setBarcode(p.barcode);
                setSearch(p.name);
              }}
              className={`${st.match} ${selected ? st.matchOn : ""}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate font-mono text-[11.5px] text-[var(--faint)]">
                  {p.barcode}
                  {p.sku ? ` · ${p.sku}` : ""}
                </span>
              </span>
              <span className={`shrink-0 font-mono text-[12px] ${p.stock <= p.lowStockThreshold ? "text-[var(--warn)]" : "text-[var(--muted)]"}`}>
                {p.stock} in stock
              </span>
              {selected && <Icon name="check" size={14} className="shrink-0 text-[var(--brand)]" />}
            </button>
          );
        })}
      </div>
    );

  const selectedCard = selectedProduct && (
    <div className={st.selected}>
      <ProductAvatar name={selectedProduct.name} />
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{selectedProduct.name}</span>
        <span className="text-[12px] text-[var(--muted)]">
          Current stock <span className="font-mono text-[var(--text)]">{selectedProduct.stock}</span> units
        </span>
      </div>
      {Number(quantity) > 0 && (
        <span className="shrink-0 text-right font-mono text-[12px] text-[var(--muted)]">
          → <span className="text-[var(--pos)]">{Number(selectedProduct.stock) + Number(quantity)}</span>
        </span>
      )}
    </div>
  );

  return (
    <WorkspaceShell>
      <PageHeader
        eyebrow="Inventory"
        title="Stock management"
        description="Monitor stock counts, catch low-inventory alerts early and record new stock intake."
        actions={
          <button
            className={ui.primary}
            onClick={() => {
              setModalOpen(true);
              setError("");
            }}
          >
            <Icon name="plus" size={15} />
            Stock Update Karein
          </button>
        }
      />

      <MetricStrip>
        <Metric label="Products" icon="box" value={stats.totalProducts.toLocaleString()} hint="Tracked in catalogue" />
        <Metric label="Units in stock" icon="layers" value={stats.totalItems.toLocaleString()} hint="Across all products" />
        <Metric label="Low stock" icon="alert" tone={stats.lowStock > 0 ? "warn" : undefined} value={stats.lowStock.toLocaleString()} hint="Needs reorder" />
        <Metric label="Out of stock" icon="x" tone={stats.outOfStock > 0 ? "neg" : undefined} value={stats.outOfStock.toLocaleString()} hint="Zero units left" />
      </MetricStrip>

      {/* Quick intake */}
      <section className={`${ui.panel} ${ui.panelFlush}`}>
        <div className={ui.panelHead}>
          <div>
            <h2>Quick stock intake</h2>
            <p>Find a product, then record how many units arrived.</p>
          </div>
        </div>
        <div className={st.intake}>
          <div className={st.intakeFind}>
            <div className={ui.field}>
              <label htmlFor="stk-search">Product name or barcode</label>
              <input
                id="stk-search"
                className={`${ui.input} ${ui.search}`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Type to search…"
              />
            </div>
            {productPicker(false)}
            <div className={`${ui.field} mt-4`}>
              <label htmlFor="stk-barcode">Or enter a barcode</label>
              <div className="flex gap-2">
                <input id="stk-barcode" className={`${ui.input} font-mono`} value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Barcode" />
                <button className={ui.secondary} type="button" onClick={() => setSearch(products.find((p) => p.barcode === barcode)?.name ?? barcode)}>
                  Find
                </button>
              </div>
            </div>
          </div>

          <form className={st.intakeForm} onSubmit={handleAddStock}>
            {selectedCard || (
              <div className={st.placeholder}>
                <Icon name="box" size={16} />
                Select a product to continue
              </div>
            )}
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label htmlFor="stk-qty">Quantity to add</label>
                <input id="stk-qty" className={`${ui.input} font-mono`} type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              </div>
              <div className={ui.field}>
                <label htmlFor="stk-note">Note / reason</label>
                <input id="stk-note" className={ui.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier invoice, restock…" />
              </div>
            </div>
            <button className={`${ui.primary} mt-4 w-full`} disabled={saving || !selectedProduct}>
              <Icon name="plus" size={15} />
              {saving ? "Saving…" : "Stock Update Karein"}
            </button>
          </form>
        </div>
      </section>

      {/* Stock list */}
      <section className={`${ui.panel} ${ui.panelFlush}`}>
        <div className={`${ui.panelHead} flex-wrap`}>
          <div className={ui.segmented} role="tablist" aria-label="Stock filter">
            {(
              [
                ["all", "All stock", null],
                ["low", "Low stock", stats.lowStock],
                ["out", "Out of stock", stats.outOfStock],
              ] as const
            ).map(([tabKey, tabLabel, count]) => (
              <button key={tabKey} role="tab" aria-selected={activeTab === tabKey} onClick={() => setActiveTab(tabKey)} className={activeTab === tabKey ? ui.segmentedOn : ""}>
                {tabKey !== "all" && <span className={`size-1.5 rounded-full ${tabKey === "low" ? "bg-[var(--warn)]" : "bg-[var(--neg)]"}`} />}
                {tabLabel}
                {count != null && <span className="font-mono text-[var(--faint)]">{count}</span>}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 justify-end gap-2 max-sm:w-full">
            <input
              className={`${ui.input} ${ui.search} max-w-[360px]`}
              placeholder="Filter by name, barcode or SKU…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Filter stock list"
            />
            <button className={ui.iconButton} onClick={() => void load()} aria-label="Refresh" title="Refresh">
              <Icon name="refresh" size={15} />
            </button>
          </div>
        </div>

        <div className={`${ui.tableWrap} ${ui.tableBare}`}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Barcode / SKU</th>
                <th>Category</th>
                <th className="text-right">Price</th>
                <th className="text-right">Stock</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!displayedProducts.length ? (
                <TableEmptyRow
                  colSpan={7}
                  icon={activeTab === "all" ? "box" : "check"}
                  title={query.trim() ? "No items match your filter" : activeTab === "all" ? "No products yet" : activeTab === "low" ? "Nothing running low" : "Nothing out of stock"}
                  body={
                    query.trim()
                      ? "Try a different name, barcode or SKU."
                      : activeTab === "all"
                      ? "Add products to your catalogue to track stock here."
                      : "All tracked products have healthy stock levels."
                  }
                />
              ) : (
                paginatedStockProducts.map((p) => {
                  const stockNum = Number(p.stock);
                  const isOut = stockNum === 0;
                  const isLow = !isOut && stockNum <= Number(p.lowStockThreshold ?? 5);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className={ui.productCell}>
                          <ProductAvatar name={p.name} />
                          <span className="truncate font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="block font-mono text-[12.5px]">{p.barcode}</span>
                        <span className="text-[12px] text-[var(--faint)]">{p.sku || "No SKU"}</span>
                      </td>
                      <td>{p.category ? <span className={ui.chip}>{p.category}</span> : <span className="text-[var(--faint)]">—</span>}</td>
                      <td className="text-right font-mono">{money(p.sellingPrice || p.price)}</td>
                      <td className={`text-right font-mono font-medium ${isOut ? "text-[var(--neg)]" : isLow ? "text-[var(--warn)]" : ""}`}>{p.stock}</td>
                      <td>
                        {isOut ? <span className={ui.outOfStock}>Out of stock</span> : isLow ? <span className={ui.lowStock}>Low stock</span> : <span className={ui.healthy}>Healthy</span>}
                      </td>
                      <td className="text-right">
                        <button
                          className={`${ui.secondary} ${ui.btnSm}`}
                          onClick={() => {
                            setBarcode(p.barcode);
                            setSearch(p.name);
                            setModalOpen(true);
                          }}
                        >
                          <Icon name="plus" size={13} />
                          Add stock
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {displayedProducts.length > 0 && (
          <PaginationControls
            currentPage={page}
            totalItems={displayedProducts.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="items"
          />
        )}
      </section>

      {/* Stock Update Sheet */}
      {modalOpen && (
        <div
          className={ui.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <form className={ui.sheet} onSubmit={handleAddStock} role="dialog" aria-modal="true" aria-label="Stock update">
            <div className={ui.sheetHead}>
              <div className="flex items-center gap-2.5">
                <span className={ui.iconTile}>
                  <Icon name="layers" size={15} />
                </span>
                <h2>Stock Update Karein</h2>
              </div>
              <button type="button" className={ui.iconButton} onClick={() => setModalOpen(false)} aria-label="Close">
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

            <div className={ui.formGrid}>
              <div className={`${ui.field} ${ui.span2}`}>
                <label htmlFor="stk-m-search">Product name or barcode</label>
                <div className="flex gap-2">
                  <input
                    id="stk-m-search"
                    className={`${ui.input} ${ui.search} flex-1`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Type a name or scan a barcode…"
                    autoFocus
                  />
                  <button type="button" className={ui.secondary} onClick={() => setScannerOpen(true)} title="Scan barcode with camera">
                    <Icon name="camera" size={15} />
                    Scan
                  </button>
                </div>
                {productPicker(true)}
              </div>

              {selectedProduct && <div className={ui.span2}>{selectedCard}</div>}

              <div className={ui.field}>
                <label htmlFor="stk-m-qty">Quantity to add</label>
                <input id="stk-m-qty" className={`${ui.input} font-mono`} type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              </div>

              <div className={ui.field}>
                <label htmlFor="stk-m-note">Note / reason (optional)</label>
                <input id="stk-m-note" className={ui.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier intake, restock…" />
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

      {/* Camera Barcode & QR Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        continuous={false}
        title="Scan Product Barcode"
        subtitle="Point camera at product barcode"
      />
    </WorkspaceShell>
  );
}
