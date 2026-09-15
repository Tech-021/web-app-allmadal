"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import ui from "@/app/components/workspace-ui.module.css";

export type Category = {
  id: string | number;
  name: string;
  description?: string;
  productCount?: number;
  totalStock?: number;
  totalValue?: number;
};

const CATEGORIES_STORAGE_KEY = "almadel_custom_categories";

function getStoredCategories(): Category[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveStoredCategories(categories: Category[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

const money = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

export default function CategoriesPage() {
  const { showToast, confirmDialog } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [serverCategories, setServerCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // 1. Load products to extract existing categories and calculate stats
      const prods = await api<Product[]>("/products").catch(() => []);
      setProducts(prods);

      // 2. Try loading categories from backend if endpoint exists
      try {
        const res = await api<Category[]>("/categories");
        if (Array.isArray(res)) setServerCategories(res);
      } catch {
        // Backend may not have dedicated /categories table, fallback to stored + product derived
      }

      // 3. Load locally saved categories
      setCustomCategories(getStoredCategories());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load categories.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // Merge server categories, custom stored categories, and categories currently used by products
  const categories = useMemo(() => {
    const map = new Map<string, Category>();

    // Add server categories
    serverCategories.forEach((c) => {
      if (c.name) {
        map.set(c.name.toLowerCase().trim(), {
          id: c.id || c.name,
          name: c.name.trim(),
          description: c.description || "",
        });
      }
    });

    // Add stored categories
    customCategories.forEach((c) => {
      const key = c.name.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, c);
      } else {
        const existing = map.get(key)!;
        map.set(key, { ...existing, description: c.description || existing.description });
      }
    });

    // Add categories derived from products
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        const key = p.category.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, {
            id: `prod-cat-${key}`,
            name: p.category.trim(),
            description: "",
          });
        }
      }
    });

    // Compute live stats for each category
    const list = Array.from(map.values()).map((cat) => {
      const catProducts = products.filter(
        (p) => String(p.category || "").toLowerCase().trim() === cat.name.toLowerCase().trim()
      );
      const productCount = catProducts.length;
      const totalStock = catProducts.reduce((sum, p) => sum + Number(p.stock || 0), 0);
      const totalValue = catProducts.reduce(
        (sum, p) => sum + Number(p.stock || 0) * Number(p.sellingPrice || p.price || 0),
        0
      );

      return {
        ...cat,
        productCount,
        totalStock,
        totalValue,
      };
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [serverCategories, customCategories, products]);

  const uncategorizedCount = useMemo(() => {
    return products.filter((p) => !p.category || !p.category.trim()).length;
  }, [products]);

  const shown = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter((c) =>
      [c.name, c.description].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [categories, query]);

  function open(cat?: Category) {
    setEditing(cat ?? null);
    setName(cat ? cat.name : "");
    setDescription(cat ? cat.description || "" : "");
    setError("");
  }

  function formatProductUpdate(p: Product, newCategory: string) {
    return {
      name: p.name,
      barcode: p.barcode,
      sku: p.sku ?? "",
      category: newCategory,
      costPrice: String(p.costPrice ?? 0),
      sellingPrice: String(p.sellingPrice || p.price || 0),
      price: String(p.sellingPrice || p.price || 0),
      stock: String(p.stock ?? 0),
      lowStockThreshold: String(p.lowStockThreshold ?? 5),
      qrCode: p.qrCode ?? "",
      imageUrl: p.imageUrl ?? "",
    };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast("Please enter a category name.", "error");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editing) {
        const oldName = editing.name;

        // 1. Try updating via API if backend /categories endpoint exists
        await api(`/categories/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: cleanName, description }),
        }).catch(() => null);

        // 2. Update all products that were assigned to the old category name
        if (oldName.toLowerCase() !== cleanName.toLowerCase()) {
          const prodsToUpdate = products.filter(
            (p) => String(p.category || "").toLowerCase().trim() === oldName.toLowerCase().trim()
          );

          if (prodsToUpdate.length > 0) {
            const results = await Promise.allSettled(
              prodsToUpdate.map((p) =>
                api(`/products/${p.id}`, {
                  method: "PATCH",
                  body: JSON.stringify(formatProductUpdate(p, cleanName)),
                })
              )
            );

            const failures = results.filter((r) => r.status === "rejected");
            if (failures.length > 0) {
              const reason = (failures[0] as PromiseRejectedResult).reason;
              const errMsg = reason instanceof Error ? reason.message : "Failed to update category on some products.";
              throw new Error(errMsg);
            }
          }
        }

        // 3. Update local storage
        const nextCustom = customCategories.map((c) =>
          String(c.id) === String(editing.id) || c.name.toLowerCase() === oldName.toLowerCase()
            ? { ...c, name: cleanName, description }
            : c
        );
        setCustomCategories(nextCustom);
        saveStoredCategories(nextCustom);

        showToast(`Category "${cleanName}" updated successfully.`, "success");
        setNotice(`Category "${cleanName}" updated.`);
      } else {
        // Create new category
        await api("/categories", {
          method: "POST",
          body: JSON.stringify({ name: cleanName, description }),
        }).catch(() => null);

        const newCat: Category = {
          id: `cat-${Date.now()}`,
          name: cleanName,
          description,
        };
        const nextCustom = [
          ...customCategories.filter((c) => c.name.toLowerCase() !== cleanName.toLowerCase()),
          newCat,
        ];
        setCustomCategories(nextCustom);
        saveStoredCategories(nextCustom);

        showToast(`Category "${cleanName}" added successfully.`, "success");
        setNotice(`Category "${cleanName}" added.`);
      }

      setEditing(undefined);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save category.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(cat: Category) {
    const affectedCount = cat.productCount || 0;
    const confirmed = await confirmDialog({
      title: "Delete Category",
      message: affectedCount > 0
        ? `Are you sure you want to delete "${cat.name}"? ${affectedCount} product${affectedCount > 1 ? "s" : ""} will become uncategorized.`
        : `Are you sure you want to delete category "${cat.name}"?`,
      confirmLabel: "Delete Category",
      danger: true,
    });
    if (!confirmed) return;

    try {
      // 1. Try backend DELETE
      await api(`/categories/${cat.id}`, { method: "DELETE" }).catch(() => null);

      // 2. Unassign from products if any
      const prodsToUnassign = products.filter(
        (p) => String(p.category || "").toLowerCase().trim() === cat.name.toLowerCase().trim()
      );
      if (prodsToUnassign.length > 0) {
        const results = await Promise.allSettled(
          prodsToUnassign.map((p) =>
            api(`/products/${p.id}`, {
              method: "PATCH",
              body: JSON.stringify(formatProductUpdate(p, "")),
            })
          )
        );

        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          const reason = (failures[0] as PromiseRejectedResult).reason;
          const errMsg = reason instanceof Error ? reason.message : "Failed to unassign category from some products.";
          throw new Error(errMsg);
        }
      }

      // 3. Remove from custom storage
      const nextCustom = customCategories.filter(
        (c) => String(c.id) !== String(cat.id) && c.name.toLowerCase() !== cat.name.toLowerCase()
      );
      setCustomCategories(nextCustom);
      saveStoredCategories(nextCustom);

      showToast(`Category "${cat.name}" deleted.`, "success");
      setNotice(`Category "${cat.name}" deleted.`);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not delete category.";
      setError(msg);
      showToast(msg, "error");
    }
  }

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>Inventory</label>
          <h1>Categories</h1>
          <p>Organize your products into catalog categories for seamless store navigation.</p>
        </div>
        <button className={ui.primary} onClick={() => open()}>
          ＋ Add category
        </button>
      </div>

      {error && <div className={ui.error}>{error}</div>}
      {notice && <div className={ui.notice}>{notice}</div>}

      <section className={ui.metrics}>
        <div className={ui.metric}>
          <span>Total Categories</span>
          <strong>{categories.length}</strong>
        </div>
        <div className={ui.metric}>
          <span>Categorized Products</span>
          <strong>{products.length - uncategorizedCount}</strong>
        </div>
        <div className={ui.metric}>
          <span>Uncategorized Products</span>
          <strong>{uncategorizedCount}</strong>
        </div>
      </section>

      <div className={ui.toolbar}>
        <input
          className={`${ui.input} ${ui.search}`}
          placeholder="Search category name or description…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className={ui.secondary} onClick={() => void load()}>
          Refresh
        </button>
      </div>

      <section className={ui.panel}>
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Description</th>
                <th>Products Count</th>
                <th>Total Stock</th>
                <th>Inventory Value</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => {
                const initial = c.name[0]?.toUpperCase() || "C";
                return (
                  <tr key={String(c.id)}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                        <div>
                          <strong style={{ fontSize: 13.5, color: "#111827", display: "block" }}>
                            {c.name}
                          </strong>
                          <span className={ui.muted}>Slug: {c.name.toLowerCase().replace(/\s+/g, "-")}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {c.description ? (
                        <span style={{ fontSize: 13, color: "#4b5563" }}>{c.description}</span>
                      ) : (
                        <span className={ui.muted}>No description</span>
                      )}
                    </td>
                    <td>
                      <span className={ui.badge} style={{ fontWeight: 800 }}>
                        {c.productCount ?? 0} item{c.productCount === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td>
                      <strong>{c.totalStock ?? 0} units</strong>
                    </td>
                    <td>
                      <strong style={{ color: "#00875a" }}>{money(c.totalValue ?? 0)}</strong>
                    </td>
                    <td>
                      <div className={ui.actions}>
                        <button className={ui.secondary} onClick={() => open(c)}>
                          Edit
                        </button>
                        <button className={ui.danger} onClick={() => void remove(c)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && !shown.length && (
                <tr>
                  <td colSpan={6} className={ui.empty}>
                    {query ? "No categories match your search." : "No categories found. Click '+ Add category' to create one."}
                  </td>
                </tr>
              )}
              {loading && !categories.length && (
                <tr>
                  <td colSpan={6} className={ui.empty}>
                    Loading categories…
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
              <h2>{editing ? "Edit category" : "Add category"}</h2>
              <button type="button" className={ui.secondary} onClick={() => setEditing(undefined)}>
                Close
              </button>
            </div>
            <div className={ui.formGrid}>
              <div className={`${ui.field} ${ui.span2}`}>
                <label>Category Name *</label>
                <input
                  className={ui.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Beverages, Clothing, Electronics"
                  required
                  autoFocus
                />
              </div>
              <div className={`${ui.field} ${ui.span2}`}>
                <label>Description (Optional)</label>
                <input
                  className={ui.input}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description for this category…"
                />
              </div>
            </div>
            <div className={ui.formActions}>
              <button type="button" className={ui.secondary} onClick={() => setEditing(undefined)}>
                Cancel
              </button>
              <button className={ui.primary} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Add Category"}
              </button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceShell>
  );
}
