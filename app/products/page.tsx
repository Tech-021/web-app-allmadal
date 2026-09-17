"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { logActivity } from "@/app/lib/logger";
import ui from "@/app/components/workspace-ui.module.css";

type Draft = {
  name: string; barcode: string; sku: string; category: string;
  costPrice: string; sellingPrice: string; stock: string; lowStockThreshold: string;
  qrCode: string; imageUrl: string;
};

const blank: Draft = {
  name: "", barcode: "", sku: "", category: "",
  costPrice: "0", sellingPrice: "", stock: "0", lowStockThreshold: "5",
  qrCode: "", imageUrl: "",
};

const money = (n: number) => `Rs ${Number(n).toLocaleString()}`;

export default function ProductsPage() {
  const { showToast, confirmDialog } = useToast();
  const { activeBusiness } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Healthy" | "Low Stock" | "Out of Stock">("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [draft, setDraft] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await api<Product[]>("/products"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load products.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, activeBusiness?.id]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const shown = useMemo(() => {
    let result = products;
    if (statusFilter === "Healthy") {
      result = result.filter((p) => Number(p.stock ?? 0) > Number(p.lowStockThreshold ?? 5));
    } else if (statusFilter === "Low Stock") {
      result = result.filter((p) => Number(p.stock ?? 0) > 0 && Number(p.stock ?? 0) <= Number(p.lowStockThreshold ?? 5));
    } else if (statusFilter === "Out of Stock") {
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
  }, [products, query, statusFilter]);

  const allShownSelected = useMemo(() => {
    return shown.length > 0 && shown.every((p) => selectedIds.includes(p.id));
  }, [shown, selectedIds]);

  const someShownSelected = useMemo(() => {
    return shown.some((p) => selectedIds.includes(p.id));
  }, [shown, selectedIds]);

  const toggleSelectAll = () => {
    if (allShownSelected) {
      const shownIds = new Set(shown.map((p) => p.id));
      setSelectedIds((prev) => prev.filter((id) => !shownIds.has(id)));
    } else {
      const shownIds = shown.map((p) => p.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...shownIds])));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  function open(p?: Product) {
    setEditing(p ?? null);
    setDraft(
      p
        ? {
            name: p.name,
            barcode: p.barcode,
            sku: p.sku ?? "",
            category: p.category ?? "",
            costPrice: String(p.costPrice),
            sellingPrice: String(p.sellingPrice || p.price),
            stock: String(p.stock),
            lowStockThreshold: String(p.lowStockThreshold),
            qrCode: p.qrCode ?? "",
            imageUrl: p.imageUrl ?? "",
          }
        : blank
    );
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim() || !draft.barcode.trim() || draft.sellingPrice === "") {
      const msg = "Product name, barcode, and selling price are required.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    setSaving(true);
    try {
      await api(editing ? `/products/${editing.id}` : "/products", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ ...draft, price: draft.sellingPrice }),
      });
      setEditing(undefined);
      const msg = editing ? "Product updated successfully." : "Product added successfully.";
      setNotice(msg);
      showToast(msg, "success");

      logActivity(
        editing ? "PRODUCT_UPDATE" : "PRODUCT_CREATE",
        "Product",
        editing
          ? `Updated product '${draft.name}' (Barcode: ${draft.barcode}, Price: Rs. ${draft.sellingPrice})`
          : `Created new product '${draft.name}' (Barcode: ${draft.barcode}, Price: Rs. ${draft.sellingPrice}, Stock: ${draft.stock})`,
        draft.name,
        { barcode: draft.barcode, category: draft.category, price: draft.sellingPrice, stock: draft.stock }
      );

      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save product.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    const confirmed = await confirmDialog({
      title: "Delete Product",
      message: `Are you sure you want to delete "${p.name}"? This action cannot be undone.`,
      confirmLabel: "Delete Product",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api(`/products/${p.id}`, { method: "DELETE" });
      setNotice("Product deleted.");
      showToast(`"${p.name}" deleted successfully.`, "success");
      setSelectedIds((prev) => prev.filter((id) => id !== p.id));

      logActivity(
        "PRODUCT_DELETE",
        "Product",
        `Deleted product '${p.name}' (Barcode: ${p.barcode})`,
        p.name,
        { id: p.id, barcode: p.barcode }
      );

      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete product.";
      setError(msg);
      showToast(msg, "error");
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;

    const count = selectedIds.length;
    const confirmed = await confirmDialog({
      title: `Delete ${count} Product${count > 1 ? "s" : ""}`,
      message: `Are you sure you want to delete ${count} selected product${count > 1 ? "s" : ""}? This action cannot be undone.`,
      confirmLabel: `Delete ${count} Product${count > 1 ? "s" : ""}`,
      danger: true,
    });
    if (!confirmed) return;

    setBulkDeleting(true);
    const toDelete = [...selectedIds];
    try {
      const results = await Promise.allSettled(
        toDelete.map((id) => api(`/products/${id}`, { method: "DELETE" }))
      );

      const successfulIds = toDelete.filter((_, idx) => results[idx].status === "fulfilled");
      const rejectedResults = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      const failedCount = rejectedResults.length;
      const firstErrorMsg = rejectedResults[0]?.reason instanceof Error
        ? rejectedResults[0].reason.message
        : "Failed to delete products.";

      if (failedCount === 0) {
        showToast(`Successfully deleted ${successfulIds.length} product${successfulIds.length > 1 ? "s" : ""}.`, "success");
        setNotice(`Deleted ${successfulIds.length} product${successfulIds.length > 1 ? "s" : ""}.`);
        logActivity(
          "BULK_PRODUCT_DELETE",
          "Product",
          `Bulk deleted ${successfulIds.length} products`,
          `${successfulIds.length} items`,
          { deletedProductIds: successfulIds }
        );
      } else if (successfulIds.length > 0) {
        showToast(`Deleted ${successfulIds.length} products (${failedCount} failed: ${firstErrorMsg})`, "error");
        setNotice(`Deleted ${successfulIds.length} products. Some items could not be deleted.`);
        logActivity(
          "BULK_PRODUCT_DELETE",
          "Product",
          `Bulk deleted ${successfulIds.length} products (${failedCount} failed)`,
          `${successfulIds.length} items`,
          { deletedProductIds: successfulIds, failedCount }
        );
      } else {
        showToast(`Failed to delete products: ${firstErrorMsg}`, "error");
        setError(firstErrorMsg);
      }

      setSelectedIds((prev) => prev.filter((id) => !successfulIds.includes(id)));
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bulk deletion encountered an error.";
      showToast(msg, "error");
      setError(msg);
    } finally {
      setBulkDeleting(false);
    }
  }

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Inventory</label>
          <h1>Products</h1>
          <p>Manage product details, pricing, barcodes, and stock status.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {selectedIds.length > 0 && (
            <button
              className={ui.danger}
              disabled={bulkDeleting}
              onClick={() => void handleBulkDelete()}
              style={{
                background: "#fee2e2",
                color: "#dc2626",
                border: "1px solid #fecaca",
                padding: "10px 18px",
                fontWeight: 800,
                boxShadow: "0 2px 8px rgba(220, 38, 38, 0.15)",
              }}
            >
              {bulkDeleting ? "Deleting…" : `🗑️ Delete Selected (${selectedIds.length})`}
            </button>
          )}
          <button className={ui.primary} onClick={() => open()}>
            ＋ Add product
          </button>
        </div>
      </div>

      {error && <div className={ui.error}>{error}</div>}
      {notice && <div className={ui.notice}>{notice}</div>}

      <div className={ui.toolbar}>
        <input
          className={`${ui.input} ${ui.search}`}
          placeholder="Search name, barcode, SKU, or category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className={ui.secondary} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <div className="no-scrollbar" style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
        {(["All", "Healthy", "Low Stock", "Out of Stock"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            style={{
              border: "1px solid",
              borderColor: statusFilter === tab ? "#00875a" : "#e5e7eb",
              background: statusFilter === tab ? "#e6f4ed" : "#ffffff",
              color: statusFilter === tab ? "#006b3f" : "#4b5563",
              padding: "6px 14px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Floating Bulk Action Banner when items are selected */}
      {selectedIds.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #056839 0%, #00875a 100%)",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: 16,
            marginBottom: 18,
            boxShadow: "0 6px 20px rgba(0, 135, 90, 0.25)",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 28,
                height: 28,
                borderRadius: 9999,
                background: "rgba(255, 255, 255, 0.25)",
                fontSize: 14,
                fontWeight: 900,
              }}
            >
              ✓
            </span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              <strong>{selectedIds.length}</strong> product{selectedIds.length > 1 ? "s" : ""} selected
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setSelectedIds([])}
              style={{
                background: "rgba(255, 255, 255, 0.18)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                color: "#ffffff",
                padding: "6px 14px",
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
            >
              Deselect All
            </button>
            <button
              disabled={bulkDeleting}
              onClick={() => void handleBulkDelete()}
              style={{
                background: "#dc2626",
                border: "none",
                color: "#ffffff",
                padding: "7px 16px",
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 800,
                cursor: bulkDeleting ? "not-allowed" : "pointer",
                boxShadow: "0 2px 10px rgba(220, 38, 38, 0.35)",
                transition: "all 0.15s ease",
              }}
            >
              {bulkDeleting ? "Deleting…" : `Delete Selected (${selectedIds.length})`}
            </button>
          </div>
        </div>
      )}

      <section className={ui.panel}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th style={{ width: 42, paddingRight: 0, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allShownSelected && someShownSelected;
                    }}
                    onChange={toggleSelectAll}
                    style={{
                      width: 17,
                      height: 17,
                      accentColor: "#00875a",
                      cursor: "pointer",
                      borderRadius: 4,
                      verticalAlign: "middle",
                    }}
                    title={allShownSelected ? "Deselect all shown" : "Select all shown"}
                  />
                </th>
                <th>Product</th>
                <th>Barcode / SKU</th>
                <th>Category</th>
                <th>Cost</th>
                <th>Sell price</th>
                <th>Stock Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const isSelected = selectedIds.includes(p.id);
                return (
                  <tr
                    key={p.id}
                    style={{
                      background: isSelected ? "#f0fdf4" : undefined,
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ width: 42, paddingRight: 0, textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.id)}
                        style={{
                          width: 17,
                          height: 17,
                          accentColor: "#00875a",
                          cursor: "pointer",
                          borderRadius: 4,
                          verticalAlign: "middle",
                        }}
                      />
                    </td>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>
                      {p.barcode}
                      <br />
                      <span className={ui.muted}>{p.sku || "No SKU"}</span>
                    </td>
                    <td>
                      {p.category ? (
                        <span className={ui.badge}>{p.category}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{money(p.costPrice)}</td>
                    <td>
                      <strong style={{ color: "#00875a" }}>
                        {money(p.sellingPrice || p.price)}
                      </strong>
                    </td>
                    <td>
                      {Number(p.stock) === 0 ? (
                        <span className={ui.outOfStock}>● Out of Stock ({p.stock})</span>
                      ) : Number(p.stock) <= Number(p.lowStockThreshold ?? 5) ? (
                        <span className={ui.lowStock}>● Low Stock ({p.stock})</span>
                      ) : (
                        <span className={ui.healthy}>● Healthy ({p.stock})</span>
                      )}
                    </td>
                    <td>
                      <div className={ui.actions}>
                        <button className={ui.secondary} onClick={() => open(p)}>
                          Edit
                        </button>
                        <button className={ui.danger} onClick={() => void remove(p)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !shown.length && (
                <tr>
                  <td colSpan={8} className={ui.empty}>
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing !== undefined && (
        <div
          className={ui.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditing(undefined);
          }}
        >
          <form className={ui.sheet} onSubmit={submit}>
            <div className={ui.sheetHead}>
              <h2>{editing ? "Edit product" : "Add product"}</h2>
              <button type="button" className={ui.secondary} onClick={() => setEditing(undefined)}>
                Close
              </button>
            </div>
            <div className={ui.formGrid}>
              {(
                [
                  ["name", "Product name"],
                  ["barcode", "Barcode"],
                  ["sku", "SKU"],
                  ["category", "Category"],
                  ["costPrice", "Cost price (Rs.)"],
                  ["sellingPrice", "Sale price (Rs.)"],
                  ["stock", editing ? "Current stock" : "Opening stock"],
                  ["lowStockThreshold", "Low stock alert threshold"],
                  ["qrCode", "QR code"],
                  ["imageUrl", "Image URL"],
                ] as [keyof Draft, string][]
              ).map(([key, label]) => (
                <div className={`${ui.field} ${key === "imageUrl" ? ui.span2 : ""}`} key={key}>
                  <label>{label}</label>
                  <input
                    className={ui.input}
                    type={["costPrice", "sellingPrice", "stock", "lowStockThreshold"].includes(key) ? "number" : "text"}
                    min="0"
                    list={key === "category" ? "categories-options" : undefined}
                    required={["name", "barcode", "sellingPrice"].includes(key)}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                  {key === "category" && (
                    <datalist id="categories-options">
                      {Array.from(
                        new Set(
                          products
                            .map((p) => p.category?.trim())
                            .filter((c): c is string => Boolean(c))
                        )
                      ).map((cat) => (
                        <option key={cat} value={cat} />
                      ))}
                    </datalist>
                  )}
                </div>
              ))}
            </div>
            <div className={ui.formActions}>
              <button type="button" className={ui.secondary} onClick={() => setEditing(undefined)}>
                Cancel
              </button>
              <button className={ui.primary} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Save Product"}
              </button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceShell>
  );
}
