"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, fetchProductCatalog, Product } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { logActivity } from "@/app/lib/logger";
import { PaginationControls } from "@/app/components/pagination-controls";
import { useBusiness } from "@/app/components/business-context";
import ui from "@/app/components/workspace-ui.module.css";
import { Overlay } from "@/app/components/overlay";
import { Icon } from "@/app/components/icons";
import { Metric, MetricStrip, PageHeader, TableEmptyRow, TableSkeletonRows } from "@/app/components/page-layout";

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
  const { activeBusiness } = useBusiness();
  const activeBusinessId = activeBusiness?.id ?? null;
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
    if (!activeBusinessId) {
      setCategories([]);
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [cats, prods] = await Promise.all([
        api<Category[]>("/categories"),
        fetchProductCatalog().catch(() => []),
      ]);
      setCategories(Array.isArray(cats) ? cats : []);
      setProducts(prods);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load categories.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId, showToast]);

  useEffect(() => {
    setQuery("");
    setPage(1);
    setNotice("");
    setEditing(undefined);
    setName("");
    setDescription("");
    void load();
  }, [activeBusinessId, load]);

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
      <PageHeader
        eyebrow="Inventory"
        title="Categories"
        description="Group products into categories so the catalogue and POS stay easy to browse."
        actions={
          <button className={ui.primary} onClick={() => open()}>
            <Icon name="plus" size={15} />
            Add category
          </button>
        }
      />

      {error && (
        <div className={ui.error} role="alert">
          <Icon name="alert" size={15} className="mt-px shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div className={ui.notice} role="status">
          <Icon name="check" size={15} className="mt-px shrink-0" />
          {notice}
        </div>
      )}

      <MetricStrip columns={3}>
        <Metric label="Categories" icon="tag" value={categories.length.toLocaleString()} hint="In your catalogue" />
        <Metric label="Categorised products" icon="box" tone="pos" value={totalCategorizedProducts.toLocaleString()} hint="Assigned to a category" />
        <Metric
          label="Uncategorised"
          icon="alert"
          tone={uncategorizedCount > 0 ? "warn" : undefined}
          value={uncategorizedCount.toLocaleString()}
          hint={uncategorizedCount > 0 ? "Assign these for cleaner reports" : "Everything is organised"}
        />
      </MetricStrip>

      <section className={`${ui.panel} ${ui.panelFlush}`}>
        <div className={ui.panelHead}>
          <input
            className={`${ui.input} ${ui.search} max-w-[440px]`}
            placeholder="Search category name or description…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search categories"
          />
          <button className={ui.iconButton} onClick={() => void load()} aria-label="Refresh" title="Refresh">
            <Icon name="refresh" size={15} />
          </button>
        </div>
        <div className={`${ui.tableWrap} ${ui.tableBare}`}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th className="text-right">Products</th>
                <th className="text-right">Total stock</th>
                <th className="text-right">Inventory value</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !categories.length ? (
                <TableSkeletonRows cols={6} rows={4} />
              ) : !shown.length ? (
                <TableEmptyRow
                  colSpan={6}
                  icon="tag"
                  title={query ? "No categories match your search" : "No categories yet"}
                  body={query ? "Try a different name or description." : "Create your first category to start organising products."}
                  action={
                    !query && (
                      <button className={ui.primary} onClick={() => open()}>
                        <Icon name="plus" size={15} />
                        Add category
                      </button>
                    )
                  }
                />
              ) : (
                paginatedShown.map((c) => {
                  const initial = c.name[0]?.toUpperCase() || "C";
                  return (
                    <tr key={String(c.id)}>
                      <td>
                        <div className={ui.productCell}>
                          <span className={ui.productThumbPlaceholder}>{initial}</span>
                          <div className="min-w-0">
                            <span className="block truncate font-medium">{c.name}</span>
                            <span className="font-mono text-[11.5px] text-[var(--faint)]">{c.name.toLowerCase().replace(/\s+/g, "-")}</span>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-[320px]">
                        {c.description ? <span className="text-[var(--text-2)]">{c.description}</span> : <span className="text-[var(--faint)]">—</span>}
                      </td>
                      <td className="text-right font-mono">{c.productCount ?? 0}</td>
                      <td className="text-right font-mono">{c.totalStock ?? 0}</td>
                      <td className="text-right font-mono font-medium">{money(c.totalValue ?? 0)}</td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button className={`${ui.secondary} ${ui.btnSm}`} onClick={() => open(c)}>
                            <Icon name="edit" size={13} />
                            Edit
                          </button>
                          <button className={`${ui.iconButton} hover:!text-[var(--neg)]`} onClick={() => void remove(c)} aria-label={`Delete ${c.name}`} title="Delete">
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      <Overlay open={editing !== undefined} onClose={() => setEditing(undefined)} variant="drawer" dismissible={!saving}>
        <form className={ui.sheet} style={{ width: "min(480px, 100%)" }} onSubmit={submit} role="dialog" aria-modal="true" aria-label={editing ? "Edit category" : "Add category"}>
          <div className={ui.sheetHead}>
            <div className="flex items-center gap-2.5">
              <span className={ui.iconTile}>
                <Icon name={editing ? "edit" : "tag"} size={15} />
              </span>
              <h2>{editing ? "Edit category" : "Add category"}</h2>
            </div>
            <button type="button" className={ui.iconButton} onClick={() => setEditing(undefined)} aria-label="Close">
              <Icon name="x" size={15} />
            </button>
          </div>
          <div className="flex flex-col gap-4">
            <div className={ui.field}>
              <label htmlFor="cat-name">Category name *</label>
              <input
                id="cat-name"
                className={ui.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Beverages, Clothing, Electronics"
                required
                autoFocus
              />
            </div>
            <div className={ui.field}>
              <label htmlFor="cat-desc">Description (optional)</label>
              <input id="cat-desc" className={ui.input} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description for this category…" />
            </div>
          </div>
          <div className={ui.formActions}>
            <button type="button" className={ui.secondary} onClick={() => setEditing(undefined)}>
              Cancel
            </button>
            <button className={ui.primary} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add category"}
            </button>
          </div>
        </form>
      </Overlay>
    </WorkspaceShell>
  );
}
