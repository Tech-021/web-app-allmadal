"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, Product } from "@/app/lib/api";
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
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | "Healthy" | "Low Stock" | "Out of Stock">("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [draft, setDraft] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await api<Product[]>("/products"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load products.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError("Product name, barcode, and selling price are required.");
      return;
    }
    setSaving(true);
    try {
      await api(editing ? `/products/${editing.id}` : "/products", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify({ ...draft, price: draft.sellingPrice }),
      });
      setEditing(undefined);
      setNotice(editing ? "Product updated." : "Product added.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`Delete ${p.name}?`)) return;
    try {
      await api(`/products/${p.id}`, { method: "DELETE" });
      setNotice("Product deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete product.");
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
        <button className={ui.primary} onClick={() => open()}>
          ＋ Add product
        </button>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
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

      <section className={ui.panel}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
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
              {shown.map((p) => (
                <tr key={p.id}>
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
              ))}
              {!loading && !shown.length && (
                <tr>
                  <td colSpan={7} className={ui.empty}>
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
                    required={["name", "barcode", "sellingPrice"].includes(key)}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
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
