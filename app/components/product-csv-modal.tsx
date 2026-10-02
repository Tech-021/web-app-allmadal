"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import { Icon } from "@/app/components/icons";
import ui from "@/app/components/workspace-ui.module.css";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";

export interface ParsedProductRow {
  index: number;
  barcode: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  sku: string;
  isValid: boolean;
  statusNotice: string;
}

interface ProductCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProductCsvModal({ isOpen, onClose, onSuccess }: ProductCsvModalProps) {
  const { showToast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedProductRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    failed: { index: number; name?: string; message: string }[];
  } | null>(null);

  if (!isOpen) return null;

  // 1. Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const headers = [
      "Barcode",
      "Product Name",
      "Category",
      "Cost Price",
      "Selling Price",
      "Current Stock",
      "Low Stock Alert",
      "SKU",
    ];

    const sampleRows = [
      ["8901234567890", "Samsung Galaxy A15 6GB/128GB", "Smartphones", "38000", "43500", "12", "3", "SAM-A15-BLK"],
      ["8909876543210", "Fast Charger 25W Type-C", "Accessories", "1200", "2200", "45", "10", "CHG-25W-WHT"],
      ["", "Tempered Glass Protector", "Protection", "80", "350", "100", "15", "TGL-UNIV"],
    ];

    const csvContent =
      "\uFEFF" +
      [
        headers.join(","),
        ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")),
      ].join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "almadel-product-import-template.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("Sample template downloaded.", "info");
  };

  // Robust RFC-4180 CSV line parser
  const parseCsvText = (text: string) => {
    const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (rawLines.length < 2) {
      showToast("CSV must contain a header and at least 1 product row.", "error");
      return;
    }

    // Parse CSV line handling quotes and escaped quotes
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === "," && !inQuotes) {
          result.push(cur.trim());
          cur = "";
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headerRow = parseLine(rawLines[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));

    // Find column indexes with flexible name variations
    const colIdx = {
      barcode: headerRow.findIndex((h) => h.includes("barcode") || h === "code"),
      name: headerRow.findIndex((h) => h.includes("name") || h.includes("title") || h.includes("item")),
      category: headerRow.findIndex((h) => h.includes("cat")),
      costPrice: headerRow.findIndex((h) => h.includes("cost") || h.includes("purchase")),
      sellingPrice: headerRow.findIndex((h) => h.includes("sell") || h.includes("price") || h.includes("sale")),
      stock: headerRow.findIndex((h) => h.includes("stock") || h.includes("qty") || h.includes("quantity")),
      lowStock: headerRow.findIndex((h) => h.includes("low") || h.includes("alert") || h.includes("thresh")),
      sku: headerRow.findIndex((h) => h.includes("sku") || h.includes("model")),
    };

    const parsed: ParsedProductRow[] = [];

    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseLine(rawLines[i]);
      if (cols.length === 0 || cols.every((c) => !c)) continue;

      const cleanNum = (val: string | undefined, def = 0) => {
        if (!val) return def;
        const cleaned = val.replace(/[^0-9.-]/g, "");
        const num = Number(cleaned);
        return isNaN(num) ? def : Math.max(0, num);
      };

      const name = colIdx.name !== -1 ? cols[colIdx.name] || "" : cols[1] || cols[0] || "";
      let barcode = colIdx.barcode !== -1 ? cols[colIdx.barcode] || "" : cols[0] || "";
      const category = colIdx.category !== -1 ? cols[colIdx.category] || "" : "";
      const costPrice = colIdx.costPrice !== -1 ? cleanNum(cols[colIdx.costPrice]) : 0;
      const sellingPrice = colIdx.sellingPrice !== -1 ? cleanNum(cols[colIdx.sellingPrice]) : 0;
      const stock = colIdx.stock !== -1 ? Math.floor(cleanNum(cols[colIdx.stock])) : 0;
      const lowStockThreshold = colIdx.lowStock !== -1 ? Math.floor(cleanNum(cols[colIdx.lowStock], 5)) : 5;
      const sku = colIdx.sku !== -1 ? cols[colIdx.sku] || "" : "";

      let isValid = true;
      let statusNotice = "Ready";

      if (!name || name.trim().length < 1) {
        isValid = false;
        statusNotice = "Missing name";
      } else if (sellingPrice <= 0) {
        isValid = false;
        statusNotice = "Invalid price (Rs 0)";
      } else if (!barcode) {
        statusNotice = "Auto-Barcode";
      }

      parsed.push({
        index: i,
        barcode: barcode.trim(),
        name: name.trim(),
        category: category.trim(),
        costPrice,
        sellingPrice,
        stock,
        lowStockThreshold,
        sku: sku.trim(),
        isValid,
        statusNotice,
      });
    }

    setRows(parsed);
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv" && !file.name.endsWith(".txt")) {
      showToast("Please upload a valid CSV file (.csv).", "error");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? "");
        parseCsvText(text);
      } catch (err) {
        showToast("Failed to parse CSV file: " + (err instanceof Error ? err.message : ""), "error");
      } finally {
        setParsing(false);
      }
    };
    reader.onerror = () => {
      setParsing(false);
      showToast("Error reading file.", "error");
    };
    reader.readAsText(file);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Submit to backend POST /products/import
  const handleImportSubmit = async () => {
    const validRows = rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      showToast("No valid product rows to import.", "error");
      return;
    }

    setImporting(true);
    try {
      const payload = {
        products: validRows.map((r) => ({
          barcode: r.barcode,
          name: r.name,
          category: r.category || undefined,
          costPrice: r.costPrice,
          sellingPrice: r.sellingPrice,
          stock: r.stock,
          lowStockThreshold: r.lowStockThreshold,
          sku: r.sku || undefined,
        })),
      };

      const res = await api<{
        created: number;
        updated: number;
        failed: { index: number; name?: string; message: string }[];
      }>("/products/import", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setImportResult(res);
      showToast(
        `Import complete: ${res.created} created, ${res.updated} updated.`,
        res.failed.length > 0 ? "info" : "success"
      );
      onSuccess();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bulk import failed.", "error");
    } finally {
      setImporting(false);
    }
  };

  const resetAll = () => {
    setFileName("");
    setRows([]);
    setImportResult(null);
  };

  const validCount = rows.filter((r) => r.isValid).length;
  const autoBarcodeCount = rows.filter((r) => r.isValid && !r.barcode).length;
  const invalidCount = rows.filter((r) => !r.isValid).length;

  const statusChip = (status: string) =>
    status === "Ready" ? ui.chipPos : status === "Auto-Barcode" ? ui.chipWarn : ui.chipNeg;

  return (
    <div className={ui.modal} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`${ui.sheet} ${ui.sheetFlush}`} style={{ width: "min(900px, 100%)" }} role="dialog" aria-modal="true" aria-label="Import products from CSV">
        <div className={`${ui.sheetHead} !mb-0 px-5 pt-5 sm:px-6`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={ui.iconTile}>
              <Icon name="upload" size={15} />
            </span>
            <div className="min-w-0">
              <h2>Import products</h2>
              <p className="m-0 mt-0.5 truncate text-[12.5px] text-[var(--muted)]">Bulk upload items, prices and stock from a spreadsheet.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className={ui.iconButton} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {importResult ? (
            <div className="flex flex-col items-center py-4 text-center">
              <span className="mb-4 grid size-12 place-items-center rounded-[14px] border border-[var(--brand-line)] bg-[var(--brand-soft)] text-[var(--brand)] [animation:almadelScaleUp_420ms_var(--ease-spring)_backwards]">
                <Icon name="check" size={22} strokeWidth={2} />
              </span>
              <h3 className="m-0 text-[20px] font-semibold tracking-[-0.025em]">Import complete</h3>
              <p className="mb-0 mt-1 text-[13px] text-[var(--muted)]">Your product catalogue has been updated.</p>

              <div className={`${ui.metrics} mt-6 w-full max-w-lg`}>
                <div className={`${ui.metric} ${ui.tonePos}`}>
                  <span>Created</span>
                  <strong className="font-mono">+{importResult.created}</strong>
                </div>
                <div className={`${ui.metric} ${ui.toneInfo}`}>
                  <span>Updated</span>
                  <strong className="font-mono">{importResult.updated}</strong>
                </div>
                <div className={`${ui.metric} ${importResult.failed.length ? ui.toneNeg : ""}`}>
                  <span>Failed</span>
                  <strong className="font-mono">{importResult.failed.length}</strong>
                </div>
              </div>

              {importResult.failed.length > 0 && (
                <div className={`${ui.error} mt-4 w-full max-w-lg !flex-col !items-stretch text-left`}>
                  <span className="flex items-center gap-2">
                    <Icon name="alert" size={14} />
                    Rows with issues
                  </span>
                  <ul className="m-0 max-h-32 list-none overflow-y-auto p-0 font-mono text-[12px] font-normal">
                    {importResult.failed.map((f, i) => (
                      <li key={i}>
                        Row {f.index}: {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 flex justify-center gap-2">
                <button type="button" onClick={resetAll} className={ui.secondary}>
                  Import another file
                </button>
                <button type="button" onClick={onClose} className={ui.primary}>
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-3.5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className={ui.metricIcon}>
                    <Icon name="file" size={14} />
                  </span>
                  <div>
                    <p className="m-0 text-[13px] font-medium">Need the recommended format?</p>
                    <p className="m-0 text-[12.5px] text-[var(--muted)]">Download a sample template with pre-filled examples.</p>
                  </div>
                </div>
                <button type="button" onClick={handleDownloadTemplate} className={ui.secondary}>
                  <Icon name="download" size={14} />
                  Template (.csv)
                </button>
              </div>

              {rows.length === 0 ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center rounded-[14px] border border-dashed p-10 text-center transition-all ${
                    dragActive ? "scale-[0.995] border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-strong)] bg-[var(--surface-2)] hover:border-[var(--faint)]"
                  }`}
                >
                  <span className={ui.emptyIcon}>
                    <Icon name="upload" size={19} />
                  </span>
                  <p className="m-0 text-[14px] font-medium">
                    Drop your CSV here, or{" "}
                    <label className="cursor-pointer text-[var(--brand-ink)] underline-offset-2 hover:underline">
                      browse
                      <input type="file" accept=".csv,.txt" onChange={onFileInputChange} className="hidden" />
                    </label>
                  </p>
                  <p className="m-0 mt-1 text-[12.5px] text-[var(--muted)]">.csv files up to 10MB</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon name="file" size={14} className="shrink-0 text-[var(--muted)]" />
                      <span className="truncate font-mono text-[13px]">{fileName}</span>
                      <span className={ui.chip}>
                        <span className="font-mono">{rows.length}</span> rows
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`${ui.chip} ${ui.chipPos}`}>
                        <Icon name="check" size={11} />
                        {validCount} ready
                      </span>
                      {autoBarcodeCount > 0 && (
                        <span className={`${ui.chip} ${ui.chipWarn}`}>
                          <Icon name="zap" size={11} />
                          {autoBarcodeCount} auto-barcode
                        </span>
                      )}
                      {invalidCount > 0 && (
                        <span className={`${ui.chip} ${ui.chipNeg}`}>
                          <Icon name="x" size={11} />
                          {invalidCount} invalid
                        </span>
                      )}
                      <button type="button" onClick={resetAll} className={`${ui.secondary} ${ui.btnSm}`}>
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className={`${ui.tableWrap} max-h-72 overflow-y-auto`}>
                    <table className={ui.table}>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Status</th>
                          <th>Product</th>
                          <th>Barcode</th>
                          <th>Category</th>
                          <th className="text-right">Price</th>
                          <th className="text-right">Cost</th>
                          <th className="text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 50).map((r, i) => (
                          <tr key={i} className={!r.isValid ? "!bg-[var(--neg-soft)]" : ""}>
                            <td className="font-mono text-[11.5px] text-[var(--faint)]">{r.index}</td>
                            <td>
                              <span className={`${ui.chip} ${ui.chipXs} ${statusChip(r.statusNotice)}`}>{r.statusNotice}</span>
                            </td>
                            <td className="max-w-[200px] truncate font-medium" title={r.name}>
                              {r.name || <span className="italic text-[var(--neg)]">Empty</span>}
                            </td>
                            <td className="font-mono text-[12px] text-[var(--text-2)]">{r.barcode || <span className="text-[11.5px] text-[var(--warn)]">Will generate</span>}</td>
                            <td className="text-[var(--muted)]">{r.category || "—"}</td>
                            <td className="text-right font-mono">Rs {r.sellingPrice.toLocaleString()}</td>
                            <td className="text-right font-mono text-[var(--muted)]">Rs {r.costPrice.toLocaleString()}</td>
                            <td className="text-right font-mono">{r.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 50 && <p className="m-0 text-center text-[12px] text-[var(--muted)]">Showing the first 50 of {rows.length} rows.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {!importResult && (
          <div className={`${ui.sectionFooter} pb-[calc(14px+env(safe-area-inset-bottom))]`}>
            <button type="button" onClick={onClose} className={ui.secondary}>
              Cancel
            </button>
            {rows.length > 0 && (
              <button type="button" disabled={importing || validCount === 0} onClick={handleImportSubmit} className={ui.primary}>
                {importing ? (
                  <>
                    <span className="size-3.5 rounded-full border-2 border-current border-t-transparent [animation:almadelSpin_700ms_linear_infinite]" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Icon name="upload" size={14} />
                    Import {validCount} products
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
