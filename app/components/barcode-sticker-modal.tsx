"use client";

import React, { useState, useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { Product } from "@/app/lib/api";
import { useBusiness } from "@/app/components/business-context";
import { useLanguage } from "@/app/components/language-context";

export type LabelLayoutType =
  | "thermal_50x25"
  | "thermal_40x30"
  | "thermal_38x25"
  | "a4_24"
  | "a4_30"
  | "a4_40";

interface LayoutConfig {
  id: LabelLayoutType;
  name: string;
  category: "thermal" | "sheet";
  widthMm: number;
  heightMm: number;
  cols: number;
  description: string;
}

const LAYOUTS: LayoutConfig[] = [
  {
    id: "thermal_50x25",
    name: "Thermal 50mm × 25mm (Standard 2\")",
    category: "thermal",
    widthMm: 50,
    heightMm: 25,
    cols: 1,
    description: "Most common retail thermal sticker roll (Xprinter / Zebra / Rongta)",
  },
  {
    id: "thermal_40x30",
    name: "Thermal 40mm × 30mm",
    category: "thermal",
    widthMm: 40,
    heightMm: 30,
    cols: 1,
    description: "Medium thermal sticker roll for grocery & pharmacy",
  },
  {
    id: "thermal_38x25",
    name: "Thermal 38mm × 25mm (Compact 1.5\")",
    category: "thermal",
    widthMm: 38,
    heightMm: 25,
    cols: 1,
    description: "Compact sticker roll for small cosmetics & jewellery",
  },
  {
    id: "a4_24",
    name: "A4 Sheet (24 Labels - 3 × 8)",
    category: "sheet",
    widthMm: 70,
    heightMm: 37,
    cols: 3,
    description: "Standard A4 adhesive sticker sheet (Avery 7160 / 3 cols × 8 rows)",
  },
  {
    id: "a4_30",
    name: "A4 Sheet (30 Labels - 3 × 10)",
    category: "sheet",
    widthMm: 64,
    heightMm: 27,
    cols: 3,
    description: "Compact A4 sticker paper (3 cols × 10 rows)",
  },
  {
    id: "a4_40",
    name: "A4 Sheet (40 Labels - 4 × 10)",
    category: "sheet",
    widthMm: 48.5,
    heightMm: 25.4,
    cols: 4,
    description: "Mini A4 sticker sheet (4 cols × 10 rows)",
  },
];

interface BarcodeStickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialSelectedIds?: number[];
}

export function BarcodeStickerModal({
  isOpen,
  onClose,
  products,
  initialSelectedIds,
}: BarcodeStickerModalProps) {
  const { activeBusiness } = useBusiness();
  const { language } = useLanguage();

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedLayout, setSelectedLayout] = useState<LabelLayoutType>("thermal_50x25");

  // Customization options
  const [showBusinessName, setShowBusinessName] = useState(true);
  const [customBusinessName, setCustomBusinessName] = useState("");
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [showSku, setShowSku] = useState(false);
  const [currencyPrefix, setCurrencyPrefix] = useState("₨");

  // Search filter inside modal
  const [search, setSearch] = useState("");

  // Initialize selected products & quantities when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const initialMap: Record<number, number> = {};
    if (initialSelectedIds && initialSelectedIds.length > 0) {
      initialSelectedIds.forEach((id) => {
        initialMap[id] = 1;
      });
    } else if (products.length > 0) {
      // Default to first product or all
      initialMap[products[0].id] = 1;
    }
    setQuantities(initialMap);
    setCustomBusinessName(activeBusiness?.name || "Almadel Store");
  }, [isOpen, initialSelectedIds, products, activeBusiness?.name]);

  const activeLayout = LAYOUTS.find((l) => l.id === selectedLayout) || LAYOUTS[0];

  // Build array of sticker items to render
  const labelItems = React.useMemo(() => {
    const list: { product: Product; index: number }[] = [];
    Object.entries(quantities).forEach(([prodIdStr, qty]) => {
      const prodId = Number(prodIdStr);
      const count = Number(qty) || 0;
      if (count > 0) {
        const prod = products.find((p) => p.id === prodId);
        if (prod) {
          for (let i = 0; i < count; i++) {
            list.push({ product: prod, index: i });
          }
        }
      }
    });
    return list;
  }, [quantities, products]);

  const totalStickerCount = labelItems.length;

  const handleQtyChange = (prodId: number, val: number) => {
    setQuantities((prev) => {
      const next = { ...prev };
      const safe = Math.max(0, Math.min(val, 999));
      if (safe === 0) {
        delete next[prodId];
      } else {
        next[prodId] = safe;
      }
      return next;
    });
  };

  const setAllQuantities = (qty: number) => {
    const next: Record<number, number> = {};
    products.forEach((p) => {
      next[p.id] = qty;
    });
    setQuantities(next);
  };

  const setAllToCurrentStock = () => {
    const next: Record<number, number> = {};
    products.forEach((p) => {
      const stock = Number(p.stock) || 0;
      if (stock > 0) {
        next[p.id] = stock;
      }
    });
    setQuantities(next);
  };

  const clearAllQuantities = () => {
    setQuantities({});
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-6xl max-h-[94vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center size-10 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xl border border-emerald-500/20">
              🏷️
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                {language === "ur" ? "Barcode Sticker Generator" : "Barcode Sticker Label Generator"}
              </h2>
              <p className="text-xs text-slate-500 font-semibold">
                {language === "ur"
                  ? "Thermal roll ya A4 sheet par stickers print karein"
                  : "Generate & print retail adhesive barcode stickers for thermal rolls or A4 sheets"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              disabled={totalStickerCount === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00875a] hover:bg-[#00704a] text-white font-extrabold text-xs shadow-md shadow-[#00875a]/25 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <span>🖨️</span>
              <span>
                {language === "ur"
                  ? `Print Karein (${totalStickerCount} Stickers)`
                  : `Print ${totalStickerCount} Sticker${totalStickerCount !== 1 ? "s" : ""}`}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-sm font-bold transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body - 2 Columns: Controls on Left, Live Preview on Right */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
          {/* Left Column: Settings, Product Selection & Layout (5 cols) */}
          <div className="lg:col-span-5 p-5 space-y-5 bg-slate-50/50 overflow-y-auto max-h-[82vh]">
            {/* Paper / Roll Layout Selector */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                {language === "ur" ? "1. Label / Paper Ka Size Chunein" : "1. Select Sticker Paper Size"}
              </label>
              <select
                value={selectedLayout}
                onChange={(e) => setSelectedLayout(e.target.value as LabelLayoutType)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
              >
                <optgroup label="Thermal Roll Printers (Xprinter / Zebra / Rongta)">
                  {LAYOUTS.filter((l) => l.category === "thermal").map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Standard A4 Sticker Sheets (Desktop Printers)">
                  {LAYOUTS.filter((l) => l.category === "sheet").map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeLayout.description}
              </p>
            </div>

            {/* Content Toggles */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                {language === "ur" ? "2. Sticker Par Kya Dikhana Hai?" : "2. Label Content Options"}
              </label>

              <div className="space-y-2 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBusinessName}
                    onChange={(e) => setShowBusinessName(e.target.checked)}
                    className="size-4 rounded accent-[#00875a]"
                  />
                  <span>Show Store Name</span>
                </label>
                {showBusinessName && (
                  <input
                    type="text"
                    value={customBusinessName}
                    onChange={(e) => setCustomBusinessName(e.target.value)}
                    placeholder="Store Name on Label"
                    className="w-full ml-6 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                  />
                )}

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={(e) => setShowProductName(e.target.checked)}
                    className="size-4 rounded accent-[#00875a]"
                  />
                  <span>Show Product Name</span>
                </label>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="size-4 rounded accent-[#00875a]"
                    />
                    <span>Show Selling Price</span>
                  </label>
                  {showPrice && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span className="text-slate-400">Currency:</span>
                      <select
                        value={currencyPrefix}
                        onChange={(e) => setCurrencyPrefix(e.target.value)}
                        className="px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-bold"
                      >
                        <option value="₨">₨ (PKR)</option>
                        <option value="Rs.">Rs.</option>
                        <option value="$">$ (USD)</option>
                      </select>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBarcodeText}
                    onChange={(e) => setShowBarcodeText(e.target.checked)}
                    className="size-4 rounded accent-[#00875a]"
                  />
                  <span>Show Barcode Digits Below Lines</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSku}
                    onChange={(e) => setShowSku(e.target.checked)}
                    className="size-4 rounded accent-[#00875a]"
                  />
                  <span>Show SKU / Item Code</span>
                </label>
              </div>
            </div>

            {/* Product Selection & Quantity Configurator */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                  {language === "ur" ? "3. Samaan Aur Tadaad" : "3. Products & Quantities"}
                </label>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {totalStickerCount} label{totalStickerCount !== 1 ? "s" : ""} selected
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAllQuantities(1)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer"
                >
                  All = 1
                </button>
                <button
                  type="button"
                  onClick={() => setAllQuantities(5)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer"
                >
                  All = 5
                </button>
                <button
                  type="button"
                  onClick={setAllToCurrentStock}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[11px] font-bold text-slate-700 transition cursor-pointer"
                  title="Set print count matching current warehouse stock"
                >
                  Match Stock
                </button>
                <button
                  type="button"
                  onClick={clearAllQuantities}
                  className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[11px] font-bold transition cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              {/* Search Box */}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products to print…"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />

              {/* Product Rows */}
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 pr-1 space-y-1">
                {filteredProducts.map((p) => {
                  const qty = quantities[p.id] || 0;
                  const isSelected = qty > 0;
                  return (
                    <div
                      key={p.id}
                      className={`py-2 px-2 rounded-xl flex items-center justify-between gap-2 transition ${
                        isSelected ? "bg-emerald-50/60" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
                          <span>{p.barcode || "No Barcode"}</span>
                          <span className="font-semibold text-emerald-700">
                            ₨ {Number(p.sellingPrice || p.price || 0).toLocaleString()}
                          </span>
                        </p>
                      </div>

                      {/* Quantity Stepper */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(p.id, qty - 1)}
                          className="size-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer active:scale-90"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={999}
                          value={qty}
                          onChange={(e) =>
                            handleQtyChange(p.id, parseInt(e.target.value, 10) || 0)
                          }
                          className="w-11 text-center py-0.5 text-xs font-black border border-slate-300 rounded-lg bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleQtyChange(p.id, qty + 1)}
                          className="size-6 rounded-lg bg-[#00875a] hover:bg-[#00704a] text-white font-bold flex items-center justify-center text-xs cursor-pointer active:scale-90"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Live Printable Sheet Preview (7 cols) */}
          <div className="lg:col-span-7 p-6 bg-slate-200/70 overflow-y-auto max-h-[82vh] flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
                Live Sticker Sheet Preview ({activeLayout.name})
              </span>
              <span className="text-xs font-bold text-slate-500">
                100% Scaled Vector SVGs (Sharp for Laser Scanners)
              </span>
            </div>

            {totalStickerCount === 0 ? (
              <div className="m-auto text-center p-8 bg-white border border-slate-300 rounded-2xl shadow-sm text-slate-500 max-w-sm">
                <span className="text-3xl block mb-2">🏷️</span>
                <p className="text-xs font-bold">No stickers selected to print</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Increase quantity (+) on any product on the left to preview its barcode sticker here.
                </p>
              </div>
            ) : (
              <div
                id="almadel-printable-stickers"
                className={`bg-white shadow-xl p-4 border border-slate-300 transition-all ${
                  activeLayout.category === "sheet"
                    ? "w-[210mm] min-h-[297mm] max-w-full"
                    : "w-[80mm] max-w-full"
                }`}
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${activeLayout.cols}, minmax(0, 1fr))`,
                  gap: "3mm",
                  boxSizing: "border-box",
                }}
              >
                {labelItems.map((item, idx) => (
                  <SingleSticker
                    key={`${item.product.id}-${idx}`}
                    product={item.product}
                    layout={activeLayout}
                    showBusinessName={showBusinessName}
                    businessName={customBusinessName}
                    showProductName={showProductName}
                    showPrice={showPrice}
                    currencyPrefix={currencyPrefix}
                    showBarcodeText={showBarcodeText}
                    showSku={showSku}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 font-semibold">
          <div className="flex items-center gap-2">
            <span>💡</span>
            <span>
              {language === "ur"
                ? "Print window mein 'Margins: None' aur 'Scale: 100%' chunein."
                : "Tip: In browser print settings, choose 'Margins: None' and 'Scale: 100%' for exact millimeter alignment."}
            </span>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            disabled={totalStickerCount === 0}
            className="px-6 py-2 rounded-xl bg-[#00875a] hover:bg-[#00704a] text-white font-extrabold shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {language === "ur" ? "Print Window Kholein" : "Open Print Dialog"}
          </button>
        </div>
      </div>

      {/* Embedded Print Stylesheet for Browser Printing */}
      <style jsx global>{`
        @media print {
          /* Hide everything in page except printable stickers */
          body * {
            visibility: hidden !important;
          }
          #almadel-printable-stickers,
          #almadel-printable-stickers * {
            visibility: visible !important;
          }
          #almadel-printable-stickers {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            background: #ffffff !important;
          }
          .almadel-sticker-cell {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}

// Subcomponent: Individual Barcode Sticker Cell with Dynamic SVG
interface SingleStickerProps {
  product: Product;
  layout: LayoutConfig;
  showBusinessName: boolean;
  businessName: string;
  showProductName: boolean;
  showPrice: boolean;
  currencyPrefix: string;
  showBarcodeText: boolean;
  showSku: boolean;
}

function SingleSticker({
  product,
  layout,
  showBusinessName,
  businessName,
  showProductName,
  showPrice,
  currencyPrefix,
  showBarcodeText,
  showSku,
}: SingleStickerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const barcodeValue = product.barcode || String(product.id || "100000000001");

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      // Determine format: EAN-13 if 13 digits, else Code 128
      const isDigitsOnly = /^\d+$/.test(barcodeValue);
      const format = isDigitsOnly && barcodeValue.length === 13 ? "EAN13" : "CODE128";

      JsBarcode(svgRef.current, barcodeValue, {
        format,
        width: layout.category === "thermal" ? 1.5 : 1.3,
        height: layout.heightMm <= 25 ? 26 : 34,
        displayValue: showBarcodeText,
        fontSize: 10,
        fontOptions: "bold",
        margin: 2,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch {
      // Fallback to Code 128 if EAN13 checksum fails
      try {
        if (svgRef.current) {
          JsBarcode(svgRef.current, barcodeValue, {
            format: "CODE128",
            width: 1.3,
            height: 28,
            displayValue: showBarcodeText,
            fontSize: 9,
            fontOptions: "bold",
            margin: 2,
            background: "#ffffff",
            lineColor: "#000000",
          });
        }
      } catch (err) {
        console.error("Barcode rendering error:", err);
      }
    }
  }, [barcodeValue, showBarcodeText, layout]);

  return (
    <div
      className="almadel-sticker-cell bg-white border border-dashed border-slate-300 rounded-md p-1.5 flex flex-col items-center justify-between text-center select-none overflow-hidden"
      style={{
        boxSizing: "border-box",
        minHeight: `${layout.heightMm}mm`,
        maxHeight: `${layout.heightMm + 2}mm`,
      }}
    >
      {/* Business Name */}
      {showBusinessName && (
        <span className="text-[10px] font-black uppercase text-slate-800 tracking-tight leading-none block truncate max-w-full">
          {businessName}
        </span>
      )}

      {/* Product Name */}
      {showProductName && (
        <span className="text-[11px] font-extrabold text-slate-900 leading-tight block truncate max-w-full mt-0.5">
          {product.name}
        </span>
      )}

      {/* Barcode Vector SVG */}
      <div className="w-full flex items-center justify-center my-0.5 max-h-[16mm] overflow-hidden">
        <svg ref={svgRef} className="max-w-full object-contain" />
      </div>

      {/* Bottom Row: SKU & Price */}
      <div className="w-full flex items-center justify-between gap-1 text-[11px] font-black leading-none px-0.5 mt-0.5">
        {showSku && (
          <span className="text-[9px] font-mono text-slate-500 truncate">
            {product.sku || `ID:${product.id}`}
          </span>
        )}
        {showPrice && (
          <span className="ml-auto text-slate-950 font-black text-xs">
            {currencyPrefix} {Number(product.sellingPrice || product.price || 0).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}
