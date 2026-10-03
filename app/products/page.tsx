"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { PageHeader, TableEmptyRow, TableSkeletonRows } from "@/app/components/page-layout";
import { Icon } from "@/app/components/icons";
import pr from "./products.module.css";
import { api, fetchProductCatalog, Product, resolveImageUrl, uploadProductImage } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { logActivity } from "@/app/lib/logger";
import { useDebounce } from "@/hooks/useDebounce";
import { validateText, validateNumber } from "@/app/lib/validators";
import { ProductCsvModal } from "@/app/components/product-csv-modal";
import { CameraBarcodeScannerModal } from "@/app/components/camera-barcode-scanner-modal";
import { BarcodeStickerModal } from "@/app/components/barcode-sticker-modal";
import { useLanguage } from "@/app/components/language-context";
import { PaginationControls } from "@/app/components/pagination-controls";
import ui from "@/app/components/workspace-ui.module.css";
import { Overlay } from "@/app/components/overlay";
import { formatRs } from "@/app/components/figures";
import { InventorySummary, healthOf, type Health } from "@/app/components/inventory-summary";
import { useNavRole } from "@/hooks/useNavRole";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";

type Draft = {
  name: string; barcode: string; sku: string; category: string;
  costPrice: string; sellingPrice: string; stock: string; lowStockThreshold: string;
  qrCode: string; imageUrl: string;
  discountType: "none" | "fixed" | "percentage";
  discountValue: string;
};

const blank: Draft = {
  name: "", barcode: "", sku: "", category: "",
  costPrice: "0", sellingPrice: "", stock: "0", lowStockThreshold: "5",
  qrCode: "", imageUrl: "",
  discountType: "none",
  discountValue: "0",
};

const HEALTH_ORDER: Record<Health, number> = { out: 0, low: 1, healthy: 2 };
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "P";

export default function ProductsPage() {
  const { showToast, confirmDialog } = useToast();
  const { activeBusiness } = useBusiness();
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [statusFilter, setStatusFilter] = useState<"All" | "Healthy" | "Low Stock" | "Out of Stock">("All");
  const [category, setCategory] = useState("All");
  const [sortMode, setSortMode] = useState<"attention" | "default">("attention");
  const navRole = useNavRole();
  const canStock = navRole === "admin";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [, setNotice] = useState("");
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [draft, setDraft] = useState(blank);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"search" | "form">("search");
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [stickerInitialIds, setStickerInitialIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await fetchProductCatalog());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load products.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, activeBusiness?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!mediaFile) {
      setFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(mediaFile);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mediaFile]);

  const productImagePreview = filePreviewUrl ?? resolveImageUrl(draft.imageUrl);

  // Socket.IO delivers the change; refresh this page's server-backed list.
  // The socket is a notification channel, not a replacement for the API read.
  useEffect(() => {
    const onRealtimeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ event?: string }>).detail;
      if (detail?.event === "product.created" || detail?.event === "product.updated" || detail?.event === "product.deleted") {
        void load();
      }
    };
    window.addEventListener("almadel_realtime_event", onRealtimeEvent);
    return () => window.removeEventListener("almadel_realtime_event", onRealtimeEvent);
  }, [load]);

  // Modal ESC key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && editing !== undefined) {
        setEditing(undefined);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editing]);

  const shown = useMemo(() => {
    let result = Array.isArray(products) ? products : [];
    if (statusFilter === "Healthy") {
      result = result.filter((p) => Number(p.stock ?? 0) > Number(p.lowStockThreshold ?? 5));
    } else if (statusFilter === "Low Stock") {
      result = result.filter((p) => Number(p.stock ?? 0) > 0 && Number(p.stock ?? 0) <= Number(p.lowStockThreshold ?? 5));
    } else if (statusFilter === "Out of Stock") {
      result = result.filter((p) => Number(p.stock ?? 0) === 0);
    }

    if (category !== "All") {
      result = result.filter((p) => (p.category?.trim() || "Uncategorised") === category);
    }

    const q = debouncedQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((p) =>
        [p.name, p.barcode, p.sku, p.category].some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        )
      );
    }
    if (sortMode === "attention") {
      result = [...result].sort((a, b) => HEALTH_ORDER[healthOf(a)] - HEALTH_ORDER[healthOf(b)]);
    }
    return result;
  }, [products, debouncedQuery, statusFilter, category, sortMode]);

  const groupCounts = useMemo(() => {
    const counts: Record<Health, number> = { out: 0, low: 0, healthy: 0 };
    shown.forEach((p) => (counts[healthOf(p)] += 1));
    return counts;
  }, [shown]);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    (Array.isArray(products) ? products : []).forEach((p) => {
      const key = p.category?.trim() || "Uncategorised";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }, [products]);


  // Reset pagination to page 1 on filter or search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter, category]);

  const paginatedShown = useMemo(() => {
    const start = (page - 1) * pageSize;
    return shown.slice(start, start + pageSize);
  }, [shown, page, pageSize]);

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

  // The bottom bar's "Add product" links here with ?new=1 to open the create form.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") !== "1") return;
    params.delete("new");
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", window.location.pathname + (qs ? `?${qs}` : ""));
    open();
  }, []);

  function open(p?: Product, initialBarcode?: string) {
    setEditing(p ?? null);
    setFieldErrors({});
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
            discountType: (p.discountType as any) || "none",
            discountValue: String(p.discountValue || 0),
          }
        : {
            ...blank,
            barcode: initialBarcode !== undefined ? initialBarcode : blank.barcode,
          }
    );
    setError("");
    setMediaFile(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};

    const nameVal = validateText(draft.name, { minLength: 2, maxLength: 100, fieldName: "Product name" });
    if (!nameVal.valid) errs.name = nameVal.error || "Product name is required.";

    const priceVal = validateNumber(draft.sellingPrice, { min: 1, fieldName: "Sale price" });
    if (!priceVal.valid) errs.sellingPrice = priceVal.error || "Sale price must be greater than 0.";

    const costVal = validateNumber(draft.costPrice || "0", { min: 0, fieldName: "Cost price" });
    if (!costVal.valid) errs.costPrice = costVal.error || "Cost price must be 0 or greater.";

    const stockVal = validateNumber(draft.stock || "0", { min: 0, integerOnly: true, fieldName: "Stock quantity" });
    if (!stockVal.valid) errs.stock = stockVal.error || "Stock must be a non-negative whole number.";

    const lowStockVal = validateNumber(draft.lowStockThreshold || "5", { min: 0, integerOnly: true, fieldName: "Low stock alert" });
    if (!lowStockVal.valid) errs.lowStockThreshold = lowStockVal.error || "Threshold must be 0 or greater.";

    let parsedDiscountVal = 0;
    if (draft.discountType !== "none") {
      const discVal = validateNumber(draft.discountValue || "0", { min: 0, fieldName: "Discount value" });
      if (!discVal.valid) errs.discountValue = discVal.error || "Discount must be 0 or greater.";
      else {
        parsedDiscountVal = Number(draft.discountValue);
        const salePrice = Number(draft.sellingPrice);
        if (draft.discountType === "percentage" && parsedDiscountVal > 100) {
          errs.discountValue = "Percentage discount cannot exceed 100%.";
        } else if (draft.discountType === "fixed" && parsedDiscountVal > salePrice) {
          errs.discountValue = "Fixed discount cannot exceed the sale price.";
        }
      }
    }

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstErr = Object.values(errs)[0];
      setError(firstErr);
      showToast(firstErr, "error");
      return;
    }

    setSaving(true);
    try {
      const imageUrl = mediaFile
        ? (await uploadProductImage(mediaFile)).url
        : (draft.imageUrl || editing?.imageUrl || "");
      const payload = {
        ...draft,
        barcode: editing?.barcode || draft.barcode || `AUTO-${Date.now()}`,
        imageUrl,
        qrCode: undefined,
        price: draft.sellingPrice,
        discountType: draft.discountType,
        discountValue: draft.discountType === "none" ? 0 : parsedDiscountVal,
      };
      await api(editing ? `/products/${editing.id}` : "/products", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
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

  const handleExportCsv = () => {
    if (products.length === 0) {
      showToast("No products available to export.", "info");
      return;
    }

    const exportItems = shown.length > 0 ? shown : products;
    const escapeCsv = (str: string | number | undefined | null) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const headers = [
      "Barcode",
      "Name",
      "Category",
      "Cost Price",
      "Selling Price",
      "Stock",
      "Low Stock Alert",
      "SKU",
      "QR Code",
    ];

    const rows = [headers.join(",")];
    for (const p of exportItems) {
      rows.push(
        [
          escapeCsv(p.barcode),
          escapeCsv(p.name),
          escapeCsv(p.category || ""),
          p.costPrice ?? 0,
          p.sellingPrice || p.price || 0,
          p.stock ?? 0,
          p.lowStockThreshold ?? 5,
          escapeCsv(p.sku || ""),
          escapeCsv(p.qrCode || ""),
        ].join(",")
      );
    }

    const csvContent = "\uFEFF" + rows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeStoreName = (activeBusiness?.name || "almadel").replace(/[^a-zA-Z0-9_-]/g, "_");
    link.href = url;
    link.download = `products-${safeStoreName}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${exportItems.length} products to CSV.`, "success");
    logActivity(
      "PRODUCT_CSV_EXPORT",
      "Product",
      `Exported ${exportItems.length} products to CSV`,
      `${exportItems.length} items`
    );
  };

  const handleBarcodeScanned = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    if (scannerTarget === "form") {
      setDraft((prev) => ({ ...prev, barcode: trimmed }));
      showToast(`Scanned barcode: ${trimmed}`, "success");
    } else {
      const match = products.find(
        (p) =>
          (p.barcode && p.barcode.trim().toLowerCase() === trimmed.toLowerCase()) ||
          (p.sku && p.sku.trim().toLowerCase() === trimmed.toLowerCase())
      );
      if (match) {
        setQuery(trimmed);
        showToast(`Found product: ${match.name}`, "success");
      } else {
        // Barcode is brand new - immediately open the Add Product modal with this barcode pre-filled!
        setQuery("");
        open(undefined, trimmed);
        showToast(
          `Scanned barcode "${trimmed}". Enter details to add this product to your store!`,
          "info"
        );
      }
    }
  };

  const netPrice = (p: { discountType?: string | null; discountValue?: number | string | null; sellingPrice?: number | string | null; price?: number | string | null }) =>
    Math.max(
      0,
      p.discountType === "percentage"
        ? Math.round(Number(p.sellingPrice || p.price) * (1 - Number(p.discountValue) / 100))
        : Number(p.sellingPrice || p.price) - Number(p.discountValue),
    );

  const fieldInput = (key: keyof Draft, label: string, opts: { type?: string; mono?: boolean; placeholder?: string } = {}) => (
    <div className={ui.field} key={key}>
      <label htmlFor={`pf-${key}`}>{label}</label>
      <input
        id={`pf-${key}`}
        className={`${ui.input} ${opts.mono ? ui.inputMono : ""} ${fieldErrors[key] ? pr.invalid : ""}`}
        type={opts.type || "text"}
        min="0"
        placeholder={opts.placeholder}
        list={key === "category" ? "categories-options" : undefined}
        required={["name", "sellingPrice"].includes(key)}
        value={draft[key]}
        onChange={(e) => {
          setDraft({ ...draft, [key]: e.target.value });
          if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: "" }));
        }}
      />
      {fieldErrors[key] && (
        <span className={pr.fieldError}>
          <Icon name="alert" size={12} />
          {fieldErrors[key]}
        </span>
      )}
    </div>
  );

  return (
    <WorkspaceShell>
      <PageHeader
        title={t("nav.products", "Products")}
        actions={
          <>
            <button className={ui.secondary} onClick={() => setShowImportModal(true)} title="Bulk import products from CSV">
              <Icon name="upload" size={14} />
              {t("action.import_csv", "Import CSV")}
            </button>
            {canStock && (
              <Link className={ui.secondary} href="/stock?restock=1">
                <Icon name="layers" size={14} />
                Stock in
              </Link>
            )}
            <button className={ui.primary} onClick={() => open()}>
              <Icon name="plus" size={15} />
              {t("action.add_product", "+ Add product").replace(/^\+\s*/, "")}
            </button>
          </>
        }
      />

      {error && !products.length && !loading ? (
        <section className={pr.errorPanel} role="alert">
          <span className={pr.errorIcon} aria-hidden>
            <Icon name="box" size={19} />
          </span>
          <div>
            <h2>Products couldn&apos;t be loaded</h2>
            <p>The server didn&apos;t answer. Your catalogue is safe — this only affects this view.</p>
            <button type="button" className={ui.primary} onClick={() => void load()}>
              <Icon name="refresh" size={15} />
              Try again
            </button>
          </div>
        </section>
      ) : (
        <InventorySummary
          products={products}
          loading={loading}
          active={statusFilter === "Healthy" ? "healthy" : statusFilter === "Low Stock" ? "low" : statusFilter === "Out of Stock" ? "out" : null}
          onFilter={(h) => setStatusFilter(h === "healthy" ? "Healthy" : h === "low" ? "Low Stock" : h === "out" ? "Out of Stock" : "All")}
        />
      )}

      {selectedIds.length > 0 && (
        <div className={ui.bulkBanner} role="region" aria-label="Bulk actions">
          <span className="text-[13px] font-medium">
            <span className="font-mono">{selectedIds.length}</span> product{selectedIds.length > 1 ? "s" : ""} selected
          </span>
          <div className={ui.bulkBannerActions}>
            <button type="button" className={`${ui.secondary} ${ui.btnSm}`} onClick={() => setSelectedIds([])}>
              Deselect all
            </button>
            <button
              type="button"
              className={`${ui.secondary} ${ui.btnSm}`}
              onClick={() => {
                setStickerInitialIds(selectedIds);
                setShowStickerModal(true);
              }}
            >
              <Icon name="printer" size={13} />
              Print labels
            </button>
            <button type="button" className={`${ui.danger} ${ui.btnSm}`} disabled={bulkDeleting} onClick={() => void handleBulkDelete()}>
              <Icon name="trash" size={13} />
              {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.length}`}
            </button>
          </div>
        </div>
      )}

      <div className={pr.toolbar}>
        <div className={pr.chips} role="tablist" aria-label="Category">
          {[{ name: "All", count: products.length }, ...categories].map((c) => (
            <button
              key={c.name}
              type="button"
              role="tab"
              aria-selected={category === c.name}
              className={`${pr.chip} ${category === c.name ? pr.chipOn : ""}`}
              onClick={() => setCategory(c.name)}
            >
              {c.name}
              <span>{c.count}</span>
            </button>
          ))}
        </div>
        <div className={pr.search}>
          <label className={pr.searchBox}>
            <Icon name="search" size={15} />
            <input
              placeholder={t("action.search", "Search name, barcode, SKU…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search products"
            />
          </label>
          <button
            type="button"
            className={ui.secondary}
            onClick={() => {
              setScannerTarget("search");
              setScannerOpen(true);
            }}
            title={t("pos.scan_camera_tip", "Scan barcode with camera")}
          >
            <Icon name="scan" size={15} />
            <span className="max-sm:hidden">Scan</span>
          </button>
          <button
            type="button"
            className={ui.iconButton}
            onClick={() => {
              setStickerInitialIds(selectedIds.length > 0 ? selectedIds : []);
              setShowStickerModal(true);
            }}
            title={t("stickers.print_btn", "Print labels")}
            aria-label={t("stickers.print_btn", "Print labels")}
          >
            <Icon name="printer" size={15} />
          </button>
          <button type="button" className={ui.iconButton} onClick={handleExportCsv} title={t("action.export_csv", "Export CSV")} aria-label={t("action.export_csv", "Export CSV")}>
            <Icon name="download" size={15} />
          </button>
          <button
            type="button"
            className={pr.sortBtn}
            onClick={() => setSortMode(sortMode === "attention" ? "default" : "attention")}
            aria-pressed={sortMode === "attention"}
            title="Change sort order"
          >
            <Icon name="updown" size={13} />
            {sortMode === "attention" ? "Needs attention first" : "Catalogue order"}
          </button>
          <button className={ui.iconButton} onClick={() => void load()} aria-label={t("action.refresh", "Refresh")} title={t("action.refresh", "Refresh")} disabled={loading}>
            <Icon name="refresh" size={15} className={loading ? pr.spinning : undefined} />
          </button>
        </div>
      </div>

      <section className={`${ui.panel} ${ui.panelFlush}`}>
        <div className={`${ui.tableWrap} ${ui.tableBare}`}>
          <table className={`${ui.table} ${pr.table}`}>
            <thead>
              <tr>
                <th className={pr.checkCol}>
                  <input
                    type="checkbox"
                    className={pr.check}
                    checked={allShownSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allShownSelected && someShownSelected;
                    }}
                    onChange={toggleSelectAll}
                    aria-label={allShownSelected ? "Deselect all shown" : "Select all shown"}
                  />
                </th>
                <th>Product</th>
                <th style={{ width: 140 }}>Category</th>
                <th style={{ width: 190 }}>Stock</th>
                <th className="text-right" style={{ width: 130 }}>Price</th>
                <th className="text-right" style={{ width: 110 }}>Cost</th>
                <th className="text-right" style={{ width: 84 }}>Margin</th>
                <th className="text-right" style={{ width: 150 }}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && !shown.length ? (
                <TableSkeletonRows cols={8} rows={6} />
              ) : !shown.length ? (
                <TableEmptyRow
                  colSpan={8}
                  icon={query ? "search" : "box"}
                  title={query ? `No products match “${query}”` : products.length ? "Nothing in this view" : "No products to sell"}
                  body={
                    query
                      ? "Check the spelling, or add it as a new product."
                      : products.length
                      ? "Try another category or stock filter."
                      : "Add products one by one, or import a CSV from your old system."
                  }
                  action={
                    query ? (
                      <button type="button" className={ui.primary} onClick={() => open(undefined, query.trim())}>
                        <Icon name="plus" size={15} />
                        Add “{query.trim()}” as new product
                      </button>
                    ) : products.length ? (
                      <button
                        type="button"
                        className={ui.secondary}
                        onClick={() => {
                          setCategory("All");
                          setStatusFilter("All");
                        }}
                      >
                        Show all products
                      </button>
                    ) : (
                      <>
                        <button type="button" className={ui.secondary} onClick={() => setShowImportModal(true)}>
                          <Icon name="upload" size={14} />
                          Import CSV
                        </button>
                        <button type="button" className={ui.primary} onClick={() => open()}>
                          <Icon name="plus" size={15} />
                          Add product
                        </button>
                      </>
                    )
                  }
                />
              ) : (
                paginatedShown.map((p, idx) => {
                  const isSelected = selectedIds.includes(p.id);
                  const hasDiscount = p.discountType && p.discountType !== "none" && Number(p.discountValue || 0) > 0;
                  const stockNum = Number(p.stock);
                  const threshold = Number(p.lowStockThreshold ?? 5);
                  const health = healthOf(p);
                  const img = resolveImageUrl(p.imageUrl);
                  const price = netPrice(p);
                  const cost = Number(p.costPrice || 0);
                  const margin = price > 0 && cost > 0 ? Math.round(((price - cost) / price) * 100) : null;
                  const meterPct = Math.min(100, (stockNum / Math.max(threshold * 2, 1)) * 100);
                  const prev = paginatedShown[idx - 1];
                  const groupStart = sortMode === "attention" && (!prev || healthOf(prev) !== health);
                  return (
                    <Fragment key={p.id}>
                      {groupStart && (
                        <tr className={pr.groupRow} data-health={health}>
                          <td colSpan={8}>
                            {health === "out" ? "Out of stock" : health === "low" ? "Needs reorder" : "Healthy"} · <span className="font-mono">{groupCounts[health]}</span>
                          </td>
                        </tr>
                      )}
                      <tr className={isSelected ? pr.rowSelected : ""}>
                        <td className={pr.checkCol}>
                          <input type="checkbox" className={pr.check} checked={isSelected} onChange={() => toggleSelect(p.id)} aria-label={`Select ${p.name}`} />
                        </td>
                        <td>
                          <div className={ui.productCell}>
                            {img ? (
                              <img className={ui.productThumb} src={img} alt="" />
                            ) : (
                              <span className={pr.thumb} aria-hidden>
                                {initials(p.name)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <span className="block truncate font-medium text-[var(--text)]">{p.name}</span>
                              <span className="block truncate font-mono text-[11.5px] text-[var(--muted)]">
                                {p.sku ? `SKU ${p.sku}` : ""}
                                {p.sku && p.barcode ? " · " : ""}
                                {p.barcode && !p.barcode.startsWith("AUTO-") ? p.barcode : p.sku ? "" : "No barcode"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="truncate">{p.category || <span className="text-[var(--faint)]">—</span>}</td>
                        <td>
                          <div className={pr.stockCell}>
                            <span className={pr.meter} aria-hidden>
                              <i style={{ width: `${Math.max(health === "out" ? 0 : 4, meterPct)}%`, background: health === "healthy" ? "var(--brand)" : health === "low" ? "var(--warn)" : "var(--neg)" }} />
                            </span>
                            <span className={`font-mono ${health === "out" ? "text-[var(--neg)]" : health === "low" ? "text-[var(--warn)]" : "text-[var(--text)]"}`}>{stockNum}</span>
                            <span className="font-mono text-[12px] text-[var(--faint)]" title="Low-stock alert level">/ {threshold}</span>
                          </div>
                        </td>
                        <td className="text-right">
                          {hasDiscount ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="font-mono text-[var(--text)]">{formatRs(price)}</span>
                              <span className="flex items-center gap-1.5">
                                <span className="font-mono text-[11.5px] text-[var(--faint)] line-through">{formatRs(Number(p.sellingPrice || p.price))}</span>
                                <span className={`${ui.chip} ${ui.chipXs} ${ui.chipPos}`}>
                                  {p.discountType === "percentage" ? `−${p.discountValue}%` : `−${p.discountValue}`}
                                </span>
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-[var(--text)]">{formatRs(price)}</span>
                          )}
                        </td>
                        <td className="text-right font-mono text-[var(--muted)]">{cost ? formatRs(cost) : "—"}</td>
                        <td className={`text-right font-mono ${margin != null && margin < 0 ? "text-[var(--neg)]" : "text-[var(--text-2)]"}`}>{margin == null ? "—" : `${margin}%`}</td>
                        <td>
                          <div className={pr.rowActions}>
                            {health !== "healthy" && canStock && (
                              <Link className={`${ui.secondary} ${ui.btnSm}`} href={`/stock?restock=${encodeURIComponent(p.barcode)}`}>
                                Reorder
                              </Link>
                            )}
                            <button
                              type="button"
                              className={ui.iconButton}
                              onClick={() => {
                                setStickerInitialIds([p.id]);
                                setShowStickerModal(true);
                              }}
                              title="Print barcode stickers"
                              aria-label={`Print barcode stickers for ${p.name}`}
                            >
                              <Icon name="printer" size={14} />
                            </button>
                            <button type="button" className={ui.iconButton} onClick={() => open(p)} title="Edit" aria-label={`Edit ${p.name}`}>
                              <Icon name="edit" size={14} />
                            </button>
                            <button type="button" className={`${ui.iconButton} ${pr.dangerIcon}`} onClick={() => void remove(p)} title="Delete" aria-label={`Delete ${p.name}`}>
                              <Icon name="trash" size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
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
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel={t("term.products", "products")}
          />
        )}
      </section>

      <Overlay open={editing !== undefined} onClose={() => setEditing(undefined)} variant="drawer" dismissible={!saving}>
        <form className={ui.sheet} style={{ width: "min(720px, 100%)" }} onSubmit={submit} role="dialog" aria-modal="true" aria-label={editing ? "Edit product" : "Add product"}>
          <div className={ui.sheetHead}>
            <div className="flex items-center gap-2.5">
              <span className={ui.iconTile}>
                <Icon name={editing ? "edit" : "box"} size={15} />
              </span>
              <div>
                <h2>{editing ? "Edit product" : "Add product"}</h2>
                {editing && <p className="m-0 mt-0.5 text-[12.5px] text-[var(--muted)]">{draft.name}</p>}
              </div>
            </div>
            <button type="button" className={ui.iconButton} onClick={() => setEditing(undefined)} aria-label="Close">
              <Icon name="x" size={15} />
            </button>
          </div>

          <div className={pr.formSection}>
            <h3>Basics</h3>
            <div className={ui.formGrid}>
              <div className={ui.span2}>{fieldInput("name", "Product name *", { placeholder: "e.g. Redmi Note 13 (8/256)" })}</div>
              <div className={ui.field}>
                <label htmlFor="pf-barcode">Barcode</label>
                <div className="flex gap-2">
                  <input
                    id="pf-barcode"
                    className={`${ui.input} ${ui.inputMono} ${fieldErrors.barcode ? pr.invalid : ""}`}
                    type="text"
                    placeholder="896400012345"
                    value={draft.barcode}
                    onChange={(e) => {
                      setDraft({ ...draft, barcode: e.target.value });
                      if (fieldErrors.barcode) setFieldErrors((prev) => ({ ...prev, barcode: "" }));
                    }}
                  />
                  <button
                    type="button"
                    className={ui.secondary}
                    onClick={() => {
                      setScannerTarget("form");
                      setScannerOpen(true);
                    }}
                    title="Scan barcode with camera"
                  >
                    <Icon name="camera" size={15} />
                    Scan
                  </button>
                </div>
                {fieldErrors.barcode && (
                  <span className={pr.fieldError}>
                    <Icon name="alert" size={12} />
                    {fieldErrors.barcode}
                  </span>
                )}
              </div>
              {fieldInput("sku", "SKU", { mono: true, placeholder: "Optional" })}
              <div className={ui.span2}>
                {fieldInput("category", "Category", { placeholder: "Pick or type a category" })}
                <datalist id="categories-options">
                  {Array.from(new Set(products.map((p) => p.category?.trim()).filter((c): c is string => Boolean(c)))).map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          <div className={pr.formSection}>
            <h3>Pricing & stock</h3>
            <div className={ui.formGrid}>
              {fieldInput("costPrice", "Cost price (Rs)", { type: "number", mono: true })}
              {fieldInput("sellingPrice", "Sale price (Rs) *", { type: "number", mono: true })}
              {fieldInput("stock", editing ? "Current stock" : "Opening stock", { type: "number", mono: true })}
              {fieldInput("lowStockThreshold", "Low-stock alert at", { type: "number", mono: true })}
            </div>
          </div>

          <div className={pr.formSection}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3>Discount</h3>
              {draft.discountType !== "none" && Number(draft.discountValue) > 0 && Number(draft.sellingPrice) > 0 && (
                <span className="text-[12.5px] text-[var(--muted)]">
                  Net price{" "}
                  <span className="font-mono font-medium text-[var(--pos)]">
                    Rs {netPrice({ discountType: draft.discountType, discountValue: draft.discountValue, sellingPrice: draft.sellingPrice }).toLocaleString()}
                  </span>
                </span>
              )}
            </div>
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label htmlFor="pf-dtype">Discount type</label>
                <Select value={draft.discountType} onValueChange={(v) => setDraft({ ...draft, discountType: v as typeof draft.discountType })}>
                  <SelectTrigger id="pf-dtype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No discount</SelectItem>
                    <SelectItem value="fixed">Fixed (Rs off)</SelectItem>
                    <SelectItem value="percentage">Percentage (% off)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={ui.field}>
                <label htmlFor="pf-dval">{draft.discountType === "percentage" ? "Percentage (%)" : "Amount (Rs)"}</label>
                <input
                  id="pf-dval"
                  className={`${ui.input} ${ui.inputMono} ${fieldErrors.discountValue ? pr.invalid : ""}`}
                  type="number"
                  min="0"
                  disabled={draft.discountType === "none"}
                  placeholder={draft.discountType === "percentage" ? "10" : "50"}
                  value={draft.discountValue}
                  onChange={(e) => {
                    setDraft({ ...draft, discountValue: e.target.value });
                    if (fieldErrors.discountValue) setFieldErrors((prev) => ({ ...prev, discountValue: "" }));
                  }}
                />
                {fieldErrors.discountValue && (
                  <span className={pr.fieldError}>
                    <Icon name="alert" size={12} />
                    {fieldErrors.discountValue}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={pr.formSection}>
            <h3>Image</h3>
            <div className={ui.imageField}>
              <div className={ui.imagePreview} aria-label={productImagePreview ? "Product image preview" : "No product image"}>
                {productImagePreview ? <img src={productImagePreview} alt="" /> : <Icon name="image" size={20} className="text-[var(--faint)]" />}
              </div>
              <div className={ui.imageFieldControls}>
                <label className={`${ui.secondary} self-start`}>
                  <Icon name="upload" size={14} />
                  {productImagePreview ? "Replace image" : "Upload image"}
                  <input className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} />
                </label>
                <span className={ui.muted}>{mediaFile?.name || (draft.imageUrl ? "Using saved product image" : "PNG, JPG, WEBP or GIF")}</span>
                {fieldErrors.imageUrl && (
                  <span className={pr.fieldError}>
                    <Icon name="alert" size={12} />
                    {fieldErrors.imageUrl}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={ui.formActions}>
            <button type="button" className={ui.secondary} onClick={() => setEditing(undefined)}>
              Cancel
            </button>
            <button className={ui.primary} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Save product"}
            </button>
          </div>
        </form>
      </Overlay>

      {/* CSV Import Modal */}
      <ProductCsvModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => void load()}
      />

      {/* Camera Barcode & QR Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScanned}
        continuous={false}
        title={scannerTarget === "form" ? "Scan Barcode for Product" : "Scan Barcode"}
        subtitle={
          scannerTarget === "form"
            ? "Point camera at product barcode"
            : "Scan barcode to find product or add as new product"
        }
      />

      {/* Barcode Sticker Label Generator Modal (Section 9 & 22) */}
      <BarcodeStickerModal
        isOpen={showStickerModal}
        onClose={() => setShowStickerModal(false)}
        products={products}
        initialSelectedIds={stickerInitialIds}
      />
    </WorkspaceShell>
  );
}

