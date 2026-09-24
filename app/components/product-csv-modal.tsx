"use client";

import { ChangeEvent, DragEvent, useState } from "react";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4.5 bg-gray-50/70">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-[#00875A]/10 text-[#00875A]">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[#111827]">Import Products (CSV)</h2>
              <p className="text-xs text-[#6b7280]">Bulk upload items, prices, and stock inventory from spreadsheets.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {importResult ? (
            /* Results Screen */
            <div className="space-y-6 text-center py-4">
              <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-emerald-50 text-[#00875A]">
                <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>

              <div>
                <h3 className="text-2xl font-black text-[#111827]">Import Completed!</h3>
                <p className="mt-1 text-xs text-[#6b7280]">
                  Your product inventory catalog has been successfully synchronized.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <p className="text-xs font-bold text-emerald-800">New Created</p>
                  <p className="mt-1 text-2xl font-black text-[#00875A]">+{importResult.created}</p>
                </div>
                <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <p className="text-xs font-bold text-blue-800">Updated</p>
                  <p className="mt-1 text-2xl font-black text-blue-600">{importResult.updated}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
                  <p className="text-xs font-bold text-gray-600">Failed</p>
                  <p className="mt-1 text-2xl font-black text-gray-800">{importResult.failed.length}</p>
                </div>
              </div>

              {importResult.failed.length > 0 && (
                <div className="text-left rounded-2xl border border-red-200 bg-red-50 p-4 max-w-lg mx-auto">
                  <p className="text-xs font-bold text-red-800 mb-2">Rows with issues:</p>
                  <ul className="text-xs text-red-700 space-y-1 max-h-32 overflow-y-auto">
                    {importResult.failed.map((f, i) => (
                      <li key={i}>
                        Row {f.index}: {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-5 py-2.5 rounded-full border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                >
                  Import Another File
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full bg-[#00875A] text-xs font-bold text-white shadow-md hover:bg-[#006b3f] transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Top Banner / Template Download */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-[#e6f4ed]/50 p-4 text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-xl">📄</span>
                  <div>
                    <strong className="text-[#00875A]">Need the recommended format?</strong>
                    <p className="text-gray-600">Download our sample template with pre-filled examples.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-white px-4 py-2 font-extrabold text-[#00875A] border border-[#00875A]/20 shadow-xs hover:bg-[#00875A] hover:text-white transition"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download Template (.csv)
                </button>
              </div>

              {/* Upload Dropzone */}
              {rows.length === 0 ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 text-center transition-all ${
                    dragActive
                      ? "border-[#00875A] bg-[#00875A]/5 scale-[0.99]"
                      : "border-gray-300 hover:border-gray-400 bg-gray-50/50"
                  }`}
                >
                  <div className="grid size-14 place-items-center rounded-2xl bg-white shadow-sm border border-gray-100 text-gray-400 mb-3">
                    <svg className="size-7 text-[#00875A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-extrabold text-[#111827]">
                    Drag & Drop your CSV file here, or{" "}
                    <label className="text-[#00875A] hover:underline cursor-pointer">
                      browse
                      <input
                        type="file"
                        accept=".csv,.txt"
                        onChange={onFileInputChange}
                        className="hidden"
                      />
                    </label>
                  </h4>
                  <p className="mt-1 text-xs text-[#9ca3af]">Supports .csv files up to 10MB.</p>
                </div>
              ) : (
                /* Staged Rows Summary & Preview */
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#111827]">{fileName}</span>
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-700">
                        {rows.length} rows detected
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                        ✓ {validCount} ready
                      </span>
                      {autoBarcodeCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800">
                          ⚡ {autoBarcodeCount} auto-barcode
                        </span>
                      )}
                      {invalidCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 font-bold text-red-800">
                          ✕ {invalidCount} invalid
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={resetAll}
                        className="text-xs font-bold text-red-600 hover:underline ml-2"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-2xl border border-gray-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Barcode</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Selling Price</th>
                          <th className="py-2.5 px-3">Cost Price</th>
                          <th className="py-2.5 px-3">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium">
                        {rows.slice(0, 50).map((r, i) => (
                          <tr
                            key={i}
                            className={`hover:bg-gray-50/70 transition ${
                              !r.isValid ? "bg-red-50/40" : ""
                            }`}
                          >
                            <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">{r.index}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                                  r.statusNotice === "Ready"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : r.statusNotice === "Auto-Barcode"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {r.statusNotice}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-bold text-[#111827] max-w-[200px] truncate" title={r.name}>
                              {r.name || <span className="text-red-500 italic">Empty</span>}
                            </td>
                            <td className="py-2 px-3 font-mono text-gray-600">
                              {r.barcode || <span className="text-amber-600 text-[10px]">Will generate</span>}
                            </td>
                            <td className="py-2 px-3 text-gray-500">{r.category || "—"}</td>
                            <td className="py-2 px-3 font-bold text-[#00875A]">
                              Rs {r.sellingPrice.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-gray-600">Rs {r.costPrice.toLocaleString()}</td>
                            <td className="py-2 px-3 text-gray-900 font-semibold">{r.stock}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 50 && (
                    <p className="text-[11px] text-gray-400 text-center italic">
                      Showing first 50 rows of {rows.length} total products.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer / Action Buttons */}
        {!importResult && (
          <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 bg-gray-50/50">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
            >
              Cancel
            </button>

            {rows.length > 0 && (
              <button
                type="button"
                disabled={importing || validCount === 0}
                onClick={handleImportSubmit}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#00875A] font-extrabold text-white text-xs shadow-md hover:bg-[#006b3f] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {importing ? (
                  <>
                    <svg className="size-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Importing Products...
                  </>
                ) : (
                  <>Import {validCount} Products</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
