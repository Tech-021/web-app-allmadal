"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, Product, uploadProductImage } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import { useBusiness } from "@/app/components/business-context";
import { logActivity } from "@/app/lib/logger";
import { useDebounce } from "@/hooks/useDebounce";
import { validateText, validateNumber } from "@/app/lib/validators";
import { ProductCsvModal } from "@/app/components/product-csv-modal";
import { CameraBarcodeScannerModal } from "@/app/components/camera-barcode-scanner-modal";
import { BarcodeStickerModal } from "@/app/components/barcode-sticker-modal";
import { useLanguage } from "@/app/components/language-context";
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
  const { t } = useLanguage();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [statusFilter, setStatusFilter] = useState<"All" | "Healthy" | "Low Stock" | "Out of Stock">("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [draft, setDraft] = useState(blank);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<"search" | "form">("search");
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [stickerInitialIds, setStickerInitialIds] = useState<number[]>([]);

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
    void load();
  }, [load]);

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
    let result = products;
    if (statusFilter === "Healthy") {
      result = result.filter((p) => Number(p.stock ?? 0) > Number(p.lowStockThreshold ?? 5));
    } else if (statusFilter === "Low Stock") {
      result = result.filter((p) => Number(p.stock ?? 0) > 0 && Number(p.stock ?? 0) <= Number(p.lowStockThreshold ?? 5));
    } else if (statusFilter === "Out of Stock") {
      result = result.filter((p) => Number(p.stock ?? 0) === 0);
    }

    const q = debouncedQuery.toLowerCase().trim();
    if (q) {
      result = result.filter((p) =>
        [p.name, p.barcode, p.sku, p.category].some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        )
      );
    }
    return result;
  }, [products, debouncedQuery, statusFilter]);

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

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstErr = Object.values(errs)[0];
      setError(firstErr);
      showToast(firstErr, "error");
      return;
    }

    setSaving(true);
    try {
      const imageUrl = mediaFile ? (await uploadProductImage(mediaFile)).url : draft.imageUrl;
      const payload = { ...draft, barcode: editing?.barcode || draft.barcode || `AUTO-${Date.now()}`, imageUrl, qrCode: undefined, price: draft.sellingPrice };
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

  return (
    <WorkspaceShell>
      <div className={ui.head}>
        <div>
          <label>{t("nav.stock", "Inventory")}</label>
          <h1>{t("nav.products", "Products")}</h1>
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
              {bulkDeleting ? "Deleting..." : `🗑️ Delete Selected (${selectedIds.length})`}
            </button>
          )}
          <button
            className={ui.secondary}
            onClick={handleExportCsv}
            title="Export products to CSV spreadsheet"
            style={{ fontWeight: 800 }}
          >
            {t("action.export_csv", "📥 Export CSV")}
          </button>
          <button
            className={ui.secondary}
            onClick={() => setShowImportModal(true)}
            title="Bulk import products from CSV spreadsheet"
            style={{ fontWeight: 800 }}
          >
            {t("action.import_csv", "📤 Import CSV")}
          </button>
          <button
            className={ui.secondary}
            onClick={() => {
              setStickerInitialIds(selectedIds.length > 0 ? selectedIds : []);
              setShowStickerModal(true);
            }}
            title="Generate and print barcode sticker labels"
            style={{ fontWeight: 800 }}
          >
            {t("stickers.print_btn", "🏷️ Print Barcode Labels")}
          </button>
          <button className={ui.primary} onClick={() => open()}>
            {t("action.add_product", "+ Add product")}
          </button>
        </div>
      </div>

      {error && <div className={ui.error}>{error}</div>}
      {notice && <div className={ui.notice}>{notice}</div>}

      <div className={ui.toolbar}>
        <input
          className={`${ui.input} ${ui.search}`}
          placeholder={t("action.search", "Search name, barcode, SKU, or category...")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={ui.secondary}
          onClick={() => {
            setScannerTarget("search");
            setScannerOpen(true);
          }}
          title={t("pos.scan_camera_tip", "Scan barcode with camera")}
          style={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}
        >
          <span>📷</span>
          <span>{t("scanner.open", "Scan Barcode")}</span>
        </button>
        <button className={ui.secondary} onClick={() => void load()}>
          {t("action.refresh", "Refresh")}
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
              onClick={() => {
                setStickerInitialIds(selectedIds);
                setShowStickerModal(true);
              }}
              style={{
                background: "#ffffff",
                border: "none",
                color: "#006b3f",
                padding: "7px 16px",
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(0, 0, 0, 0.15)",
                transition: "all 0.15s ease",
              }}
            >
              🏷️ Print Labels ({selectedIds.length})
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
              {bulkDeleting ? "Deleting..." : `Delete Selected (${selectedIds.length})`}
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
                        <button
                          className={ui.secondary}
                          onClick={() => {
                            setStickerInitialIds([p.id]);
                            setShowStickerModal(true);
                          }}
                          title="Print barcode stickers for this product"
                          style={{ padding: "6px 10px" }}
                        >
                          🏷️
                        </button>
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
                    <div style={{ padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                        {query
                          ? `No products found matching "${query}".`
                          : "No products found."}
                      </p>
                      {query && (
                        <button
                          type="button"
                          className={ui.primary}
                          onClick={() => {
                            const candidate = query.trim();
                            open(undefined, candidate);
                          }}
                          style={{
                            padding: "8px 20px",
                            fontSize: 13,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            borderRadius: 9999,
                            cursor: "pointer",
                          }}
                        >
                          <span>+</span>
                          <span>Add "{query.trim()}" as New Product</span>
                        </button>
                      )}
                    </div>
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
                  ["name", "Product name *"],
                  ["barcode", "Barcode"],
                  ["sku", "SKU"],
                  ["category", "Category"],
                  ["costPrice", "Cost price (Rs.)"],
                  ["sellingPrice", "Sale price (Rs.) *"],
                  ["stock", editing ? "Current stock" : "Opening stock"],
                  ["lowStockThreshold", "Low stock alert threshold"],
                  ["imageUrl", "Product image"],
                ] as [keyof Draft, string][]
              ).map(([key, label]) => (
                <div className={`${ui.field} ${key === "imageUrl" ? ui.span2 : ""}`} key={key}>
                  <label>{label}</label>
                  {key === "imageUrl" ? (
                    <>
                      <input
                        className={ui.input}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                      />
                      {(mediaFile?.name || draft.imageUrl) && (
                        <span className={ui.muted}>{mediaFile?.name || "Current image selected"}</span>
                      )}
                    </>
                  ) : key === "barcode" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        className={`${ui.input} ${fieldErrors[key] ? "border-red-500 bg-red-50/40" : ""}`}
                        style={{ flex: 1 }}
                        type="text"
                        placeholder="e.g. 896400012345"
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
                        style={{ padding: "0 12px", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <span>📷</span>
                        <span>Scan</span>
                      </button>
                    </div>
                  ) : (
                    <input
                      className={`${ui.input} ${fieldErrors[key] ? "border-red-500 bg-red-50/40" : ""}`}
                      type={["costPrice", "sellingPrice", "stock", "lowStockThreshold"].includes(key) ? "number" : "text"}
                      min="0"
                      list={key === "category" ? "categories-options" : undefined}
                      required={["name", "sellingPrice"].includes(key)}
                      value={draft[key]}
                      onChange={(e) => {
                        setDraft({ ...draft, [key]: e.target.value });
                        if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: "" }));
                      }}
                    />
                  )}
                  {fieldErrors[key] && (
                    <span className="text-[11px] font-bold text-red-600 mt-1 block">
                      {fieldErrors[key]}
                    </span>
                  )}
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
                {saving ? "Saving..." : editing ? "Save changes" : "Save Product"}
              </button>
            </div>
          </form>
        </div>
      )}

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

