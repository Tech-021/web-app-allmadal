"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { logActivity } from "@/app/lib/logger";
import { PaginationControls } from "@/app/components/pagination-controls";
import ui from "@/app/components/workspace-ui.module.css";

export type Category = {
  id: string | number;
  name: string;
  description?: string | null;
  productCount?: number;
  totalStock?: number;
  totalValue?: number;
  createdAt?: string;
  updatedAt?: string;
};

const money = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

export default function CategoriesPage() {
  const { showToast, confirmDialog } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
      const [cats, prods] = await Promise.all([
        api<Category[]>("/categories"),
        api<Product[]>("/products").catch(() => []),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setProducts(Array.isArray(prods) ? prods : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load categories.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const uncategorizedCount = useMemo(() => {
    return products.filter((p) => !p.category || !p.category.trim()).length;
  }, [products]);

  const totalCategorizedProducts = useMemo(() => {
    return products.filter((p) => p.category && p.category.trim()).length;
  }, [products]);

  const shown = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter((c) =>
      [c.name, c.description].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [categories, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const paginatedShown = useMemo(() => {
    const start = (page - 1) * pageSize;
    return shown.slice(start, start + pageSize);
  }, [shown, page, pageSize]);

  function open(cat?: Category) {
    setEditing(cat ?? null);
    setName(cat ? cat.name : "");
    setDescription(cat ? cat.description || "" : "");
    setError("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      showToast("Category name must be at least 2 characters long.", "error");
      return;
    }
    if (cleanName.length > 50) {
      showToast("Category name cannot exceed 50 characters.", "error");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editing) {
        const oldName = editing.name;

        await api(`/categories/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: cleanName, description }),
        });

        showToast(`Category "${cleanName}" updated successfully.`, "success");
        setNotice(`Category "${cleanName}" updated.`);

        logActivity(
          "CATEGORY_UPDATE",
          "Category",
          `Updated category '${oldName}' -> '${cleanName}'`,
          cleanName,
          { oldName, newName: cleanName, description }
        );
      } else {
        await api("/categories", {
          method: "POST",
          body: JSON.stringify({ name: cleanName, description }),
        });

        showToast(`Category "${cleanName}" added successfully.`, "success");
        setNotice(`Category "${cleanName}" added.`);

        logActivity(
          "CATEGORY_CREATE",
          "Category",
          `Created category '${cleanName}'`,
          cleanName,
          { name: cleanName, description }
        );
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
      message:
        affectedCount > 0
          ? `Are you sure you want to delete "${cat.name}"? ${affectedCount} product${
              affectedCount > 1 ? "s" : ""
            } will become uncategorized.`
          : `Are you sure you want to delete category "${cat.name}"?`,
      confirmLabel: "Delete Category",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api(`/categories/${cat.id}`, { method: "DELETE" });

      showToast(`Category "${cat.name}" deleted.`, "success");
      setNotice(`Category "${cat.name}" deleted.`);

      logActivity(
        "CATEGORY_DELETE",
        "Category",
        `Deleted category '${cat.name}' (${affectedCount} products unassigned)`,
        cat.name,
        { name: cat.name, unassignedProductsCount: affectedCount }
      );

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
          <strong>{totalCategorizedProducts}</strong>
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
              {paginatedShown.map((c) => {
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
                    {query
                      ? "No categories match your search."
                      : "No categories found. Click '+ Add category' to create one."}
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

        {shown.length > 0 && (
          <PaginationControls
            currentPage={page}
            totalItems={shown.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[5, 10, 25, 50]}
            itemLabel="categories"
          />
        )}
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
