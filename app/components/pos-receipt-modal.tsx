"use client";

import React, { useRef, useState } from "react";
import { useBusiness } from "@/app/components/business-context";

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface DetailedSaleReceipt {
  id?: number | string;
  invoiceNumber: string;
  createdAt: string;
  customerName?: string | null;
  customerMobile?: string | null;
  items: ReceiptItem[];
  subtotal: number;
  discountAmount?: number;
  discountType?: string;
  totalAmount: number;
  paymentMethod: string;
  cashTendered?: number;
  changeDue?: number;
  userName?: string;
  cashierName?: string;
}

export type ReceiptSale = DetailedSaleReceipt;

interface PosReceiptModalProps {
  isOpen?: boolean;
  receipt?: DetailedSaleReceipt | null;
  sale?: DetailedSaleReceipt | null;
  onClose: () => void;
  onNewSale?: () => void;
}

export function PosReceiptModal({
  isOpen = true,
  receipt,
  sale,
  onClose,
  onNewSale,
}: PosReceiptModalProps) {
  const { activeBusiness } = useBusiness();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printSize, setPrintSize] = useState<"thermal" | "standard">("thermal");

  const activeReceipt = receipt || sale;
  if (!isOpen || !activeReceipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(activeReceipt.createdAt).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedTime = new Date(activeReceipt.createdAt).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const paymentMethodDisplay =
    activeReceipt.paymentMethod?.toLowerCase() === "cash"
      ? "Cash"
      : activeReceipt.paymentMethod?.toLowerCase() === "online"
      ? "Online / Bank"
      : activeReceipt.paymentMethod?.toUpperCase() || "Paid";

  return (
    <>
      {/* Print Specific CSS to prevent vertical centering, empty top space, and strip colors */}
      <style>{`
        @media print {
          @page {
            margin: 4mm 6mm;
            size: auto;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide everything outside of print container */
          body * {
            visibility: hidden;
          }
          #pos-print-wrapper, #pos-print-wrapper * {
            visibility: visible;
          }
          #pos-print-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: flex !important;
            justify-content: center !important;
            background: transparent !important;
          }
          #pos-receipt-card {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 2mm 4mm !important;
            margin: 0 auto !important;
            width: ${printSize === "thermal" ? "78mm" : "100%"} !important;
            max-width: ${printSize === "thermal" ? "80mm" : "140mm"} !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Screen Backdrop & Modal Shell */}
      <div
        id="pos-print-wrapper"
        className="fixed inset-0 z-[99999] flex items-start justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div
          id="pos-receipt-card"
          className="relative w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-6 my-auto font-sans text-slate-800 transition-all"
        >
          {/* Top Controls Toolbar (Hidden in Print) */}
          <div className="no-print flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Size:</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setPrintSize("thermal")}
                  className={`px-2 py-0.5 rounded-md transition ${
                    printSize === "thermal"
                      ? "bg-white text-emerald-700 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  80mm Slip
                </button>
                <button
                  type="button"
                  onClick={() => setPrintSize("standard")}
                  className={`px-2 py-0.5 rounded-md transition ${
                    printSize === "standard"
                      ? "bg-white text-emerald-700 font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Full / A4
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Close receipt"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Printable Receipt Content */}
          <div ref={receiptRef} className="space-y-4">
            
            {/* Header: Store Identity & Branding */}
            <div className="text-center space-y-1">
              <div className="size-12 rounded-2xl bg-[#00875a] text-white flex items-center justify-center text-xl font-black mx-auto shadow-md shadow-[#00875a]/20 border-2 border-emerald-700">
                {activeBusiness?.name ? activeBusiness.name[0]?.toUpperCase() : "A"}
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight mt-2 uppercase">
                {activeBusiness?.name || "Almadel Retail Store"}
              </h2>
              {activeBusiness?.address && (
                <p className="text-xs text-slate-600 font-medium leading-tight">
                  {activeBusiness.address}
                  {activeBusiness.city ? `, ${activeBusiness.city}` : ""}
                </p>
              )}
              {activeBusiness?.mobileNumber && (
                <p className="text-xs text-slate-600 font-medium">
                  Phone: {activeBusiness.mobileNumber}
                </p>
              )}
              {activeBusiness?.taxRegistered === "yes" && activeBusiness?.ntn && (
                <p className="text-[11px] text-slate-500 font-semibold">
                  NTN: {activeBusiness.ntn}
                </p>
              )}
            </div>

            {/* Prominent Paid Status Banner */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center size-4 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                  ✓
                </span>
                <span className="text-xs font-black tracking-wider uppercase">
                  Payment Status: PAID
                </span>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase">
                {paymentMethodDisplay}
              </span>
            </div>

            {/* Invoice Meta Bar */}
            <div className="border-y border-dashed border-slate-300 py-2.5 text-xs text-slate-600 space-y-1">
              <div className="flex justify-between items-center font-extrabold text-slate-900">
                <span>INVOICE #{activeReceipt.invoiceNumber}</span>
                <span className="uppercase text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                  PAID &bull; {paymentMethodDisplay}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Date: {formattedDate}</span>
                <span>Time: {formattedTime}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span>Customer:</span>
                <strong className="text-slate-900">
                  {activeReceipt.customerName || "Walk-in Customer"}
                </strong>
              </div>
              {activeReceipt.customerMobile && (
                <div className="flex justify-between text-[11px]">
                  <span>Mobile:</span>
                  <span className="font-mono">{activeReceipt.customerMobile}</span>
                </div>
              )}
            </div>

            {/* Itemized Products Table */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between font-extrabold text-slate-500 text-[10px] border-b border-slate-200 pb-1 uppercase tracking-wider">
                <span className="w-1/2">Item</span>
                <span className="w-1/6 text-center">Qty</span>
                <span className="w-1/6 text-right">Rate</span>
                <span className="w-1/6 text-right">Total</span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto print:max-h-none">
                {(activeReceipt.items || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-b-0"
                  >
                    <span className="w-1/2 font-bold text-slate-900 truncate pr-1">
                      {item.name}
                    </span>
                    <span className="w-1/6 text-center text-slate-600 font-medium">
                      {item.quantity}
                    </span>
                    <span className="w-1/6 text-right text-slate-600">
                      ₨{item.price.toLocaleString()}
                    </span>
                    <span className="w-1/6 text-right font-bold text-slate-900">
                      ₨{item.total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="border-t border-dashed border-slate-300 pt-2.5 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-bold">₨ {activeReceipt.subtotal.toLocaleString()}</span>
              </div>

              {activeReceipt.discountAmount && activeReceipt.discountAmount > 0 ? (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>
                    Discount ({activeReceipt.discountType === "percentage" ? "Percent" : "Fixed"})
                  </span>
                  <span>- ₨ {activeReceipt.discountAmount.toLocaleString()}</span>
                </div>
              ) : null}

              <div className="flex justify-between text-base font-black text-slate-900 pt-1.5 border-t border-slate-200 items-baseline">
                <span>Grand Total</span>
                <div className="text-right">
                  <span className="text-[#00875a] text-lg font-black">
                    ₨ {activeReceipt.totalAmount.toLocaleString()}
                  </span>
                  <span className="block text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                    [ Fully Paid ]
                  </span>
                </div>
              </div>

              {activeReceipt.paymentMethod?.toLowerCase() === "cash" &&
                activeReceipt.cashTendered !== undefined &&
                activeReceipt.cashTendered > 0 && (
                  <>
                    <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                      <span>Cash Tendered</span>
                      <span className="font-bold">
                        ₨ {activeReceipt.cashTendered.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-emerald-800 font-bold">
                      <span>Change Due (Wapsi)</span>
                      <span>
                        ₨ {Math.max(0, activeReceipt.changeDue || 0).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
            </div>

            {/* OFFICIAL ALMADEL "PAID" STAMP */}
            <div className="flex justify-center pt-2">
              <div className="relative inline-flex flex-col items-center justify-center border-4 border-double border-emerald-600 text-emerald-700 px-5 py-2.5 rounded-2xl transform -rotate-3 select-none bg-emerald-50/60 shadow-xs">
                <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-700">
                  <span>★</span>
                  <span>ALMADEL OFFICIAL STAMP</span>
                  <span>★</span>
                </div>
                <div className="text-2xl font-black tracking-widest text-emerald-700 my-0.5 flex items-center gap-1">
                  <svg
                    className="w-5 h-5 text-emerald-600 stroke-[3]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>PAID</span>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                  {paymentMethodDisplay} &bull; VERIFIED BILL
                </div>
                <div className="text-[8px] font-mono text-emerald-600/90 mt-0.5 font-bold">
                  {activeReceipt.invoiceNumber}
                </div>
              </div>
            </div>

            {/* Shukriya / Thank You Note */}
            <div className="text-center pt-2 border-t border-dashed border-slate-300">
              <p className="text-sm font-extrabold text-[#00875a]">Shukriya! (Thank You)</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                Dobara Tashreef Layen 🤍
              </p>
              <p className="text-[9px] text-slate-400 mt-1.5 font-mono">
                Powered by Almadel POS &bull; Store Management Portal
              </p>
            </div>
          </div>

          {/* Action Buttons (Hidden on Print) */}
          <div className="no-print mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full py-3 px-4 rounded-2xl bg-[#00875a] hover:bg-[#00744e] text-white font-extrabold text-sm shadow-lg shadow-[#00875a]/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              <span>Print Receipt / Invoice</span>
            </button>

            <div className="flex gap-2">
              {onNewSale && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNewSale();
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#00875a] font-bold text-xs transition cursor-pointer"
                >
                  + New Sale
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
