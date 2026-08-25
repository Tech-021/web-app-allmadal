"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import ui from "@/app/components/workspace-ui.module.css";

export default function StockPage() {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setProducts(await api<Product[]>("/products"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load products.";
      setError(msg);
      showToast(msg, "error");
    }
  }, [showToast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const selected = products.find((p) => p.barcode === barcode);

  const matches = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q
      ? products
          .filter((p) =>
            [p.name, p.barcode, p.sku].some((v) =>
              String(v ?? "").toLowerCase().includes(q)
            )
          )
          .slice(0, 8)
      : [];
  }, [products, search]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!barcode || Number(quantity) < 1) {
      const msg = "Choose a product and enter a quantity of at least 1.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const updated = await api<Product>("/stock/add", {
        method: "POST",
        body: JSON.stringify({ barcode, quantity, note }),
      });
      const msg = `${updated.name} stock updated from ${selected?.stock ?? 0} to ${updated.stock}.`;
      setNotice(msg);
      showToast(msg, "success");
      setQuantity("1");
      setNote("");
      setSearch("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not add stock.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Inventory</label>
          <h1>Stock Management</h1>
          <p>Find a product manually and add received inventory stock.</p>
        </div>
      </div>

      {error && <div className={ui.error}>{error}</div>}
      {notice && <div className={ui.notice}>{notice}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.2fr) minmax(280px,.8fr)",
          gap: 18,
        }}
      >
        <section className={ui.panel}>
          <h2 style={{ marginTop: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>
            Choose Product
          </h2>
          <div className={ui.field}>
            <label>Search by name, barcode, or SKU</label>
            <input
              className={ui.input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Start typing product name or barcode…"
            />
          </div>

          {matches.length > 0 && (
            <div
              style={{
                marginTop: 12,
                border: "1px solid #eaeaeb",
                borderRadius: 14,
                overflow: "hidden",
              }}
            >
              {matches.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    setBarcode(p.barcode);
                    setSearch(p.name);
                  }}
                  style={{
                    display: "flex",
                    width: "100%",
                    justifyContent: "space-between",
                    padding: 13,
                    border: 0,
                    borderBottom: "1px solid #eaeaeb",
                    background: p.barcode === barcode ? "#e6f4ed" : "#ffffff",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s ease",
                  }}
                >
                  <span>
                    <strong style={{ color: p.barcode === barcode ? "#006b3f" : "#111827" }}>
                      {p.name}
                    </strong>
                    <small style={{ display: "block", color: "#6b7280", marginTop: 3 }}>
                      {p.barcode}
                      {p.sku ? ` · ${p.sku}` : ""}
                    </small>
                  </span>
                  <strong style={{ color: p.stock <= p.lowStockThreshold ? "#d97706" : "#059669" }}>
                    {p.stock} in stock
                  </strong>
                </button>
              ))}
            </div>
          )}

          <div className={ui.field} style={{ marginTop: 16 }}>
            <label>Or enter barcode directly</label>
            <div style={{ display: "flex", gap: 10 }}>
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

        <form className={ui.panel} onSubmit={submit}>
          <h2 style={{ marginTop: 0, fontSize: 17, fontWeight: 800, color: "#111827" }}>
            Stock Details
          </h2>

          {selected ? (
            <div className={ui.notice} style={{ background: "#e6f4ed", color: "#006b3f" }}>
              <strong>{selected.name}</strong>
              <br />
              Current stock: <strong>{selected.stock} units</strong>
            </div>
          ) : (
            <p className={ui.muted}>Select a product to continue.</p>
          )}

          <div className={ui.field}>
            <label>Quantity to add</label>
            <input
              className={ui.input}
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className={ui.field} style={{ marginTop: 14 }}>
            <label>Note (optional)</label>
            <input
              className={ui.input}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Supplier, invoice, or intake reason"
            />
          </div>

          <button
            className={ui.primary}
            style={{ width: "100%", marginTop: 22, height: 48, fontSize: 14, fontWeight: 800 }}
            disabled={loading || !selected}
          >
            {loading ? "Saving…" : "Stock Update Karein"}
          </button>
        </form>
      </div>
    </WorkspaceShell>
  );
}
