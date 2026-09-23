"use client";

import React, { useRef } from "react";
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

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 my-auto font-sans text-gray-800 print:shadow-none print:border-none print:p-2 print:max-w-full">
        {/* Printable Receipt Container */}
        <div ref={receiptRef} className="print-area space-y-4">
          
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="size-12 rounded-2xl bg-[#00875a] text-white flex items-center justify-center text-xl font-black mx-auto shadow-md shadow-[#00875a]/20 print:shadow-none">
              {activeBusiness?.name ? activeBusiness.name[0]?.toUpperCase() : "A"}
            </div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight mt-2">
              {activeBusiness?.name || "Almadel Retail Store"}
            </h2>
            {activeBusiness?.address && (
              <p className="text-xs text-gray-500 font-medium leading-tight">
                {activeBusiness.address}{activeBusiness.city ? `, ${activeBusiness.city}` : ""}
              </p>
            )}
            {activeBusiness?.mobileNumber && (
              <p className="text-xs text-gray-500 font-medium">
                Phone: {activeBusiness.mobileNumber}
              </p>
            )}
            {activeBusiness?.taxRegistered === "yes" && activeBusiness?.ntn && (
              <p className="text-[11px] text-gray-400 font-semibold">
                NTN: {activeBusiness.ntn}
              </p>
            )}
          </div>

          {/* Invoice Meta Bar */}
          <div className="border-y border-dashed border-gray-300 py-2.5 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between items-center font-extrabold text-gray-900">
              <span>INVOICE #{activeReceipt.invoiceNumber}</span>
              <span className="uppercase text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                {activeReceipt.paymentMethod}
              </span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Date: {formattedDate}</span>
              <span>Time: {formattedTime}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span>Customer:</span>
              <strong className="text-gray-900">
                {activeReceipt.customerName || "Walk-in Customer"}
              </strong>
            </div>
            {activeReceipt.customerMobile && (
              <div className="flex justify-between text-[11px]">
                <span>Mobile:</span>
                <span>{activeReceipt.customerMobile}</span>
              </div>
            )}
          </div>

          {/* Itemized Products Table */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between font-extrabold text-gray-400 text-[10px] border-b border-gray-200 pb-1 uppercase tracking-wider">
              <span className="w-1/2">Item</span>
              <span className="w-1/6 text-center">Qty</span>
              <span className="w-1/6 text-right">Rate</span>
              <span className="w-1/6 text-right">Total</span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto print:max-h-none">
              {(activeReceipt.items || []).map((item, idx) => (
                <div key={idx} className="flex justify-between text-xs py-0.5 border-b border-gray-100 last:border-b-0">
                  <span className="w-1/2 font-bold text-gray-900 truncate pr-1">
                    {item.name}
                  </span>
                  <span className="w-1/6 text-center text-gray-600 font-medium">
                    {item.quantity}
                  </span>
                  <span className="w-1/6 text-right text-gray-600">
                    ₨{item.price.toLocaleString()}
                  </span>
                  <span className="w-1/6 text-right font-bold text-gray-900">
                    ₨{item.total.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="border-t border-dashed border-gray-300 pt-2.5 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-bold">₨ {activeReceipt.subtotal.toLocaleString()}</span>
            </div>

            {activeReceipt.discountAmount && activeReceipt.discountAmount > 0 ? (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Discount ({activeReceipt.discountType === "percentage" ? "Percent" : "Fixed"})</span>
                <span>- ₨ {activeReceipt.discountAmount.toLocaleString()}</span>
              </div>
            ) : null}

            <div className="flex justify-between text-base font-black text-gray-900 pt-1.5 border-t border-gray-200">
              <span>Grand Total</span>
              <span className="text-[#00875a]">₨ {activeReceipt.totalAmount.toLocaleString()}</span>
            </div>

            {activeReceipt.paymentMethod?.toLowerCase() === "cash" && activeReceipt.cashTendered !== undefined && activeReceipt.cashTendered > 0 && (
              <>
                <div className="flex justify-between text-[11px] text-gray-500 pt-1">
                  <span>Cash Tendered</span>
                  <span className="font-bold">₨ {activeReceipt.cashTendered.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] text-emerald-800 font-bold">
                  <span>Change Due (Wapsi)</span>
                  <span>₨ {Math.max(0, (activeReceipt.changeDue || 0)).toLocaleString()}</span>
                </div>
              </>
            )}
          </div>

          {/* Shukriya / Thank You Note */}
          <div className="text-center pt-3 border-t border-dashed border-gray-300">
            <p className="text-sm font-extrabold text-[#00875a]">Shukriya! (Thank You)</p>
            <p className="text-[11px] font-semibold text-gray-500 mt-0.5">
              Dobara Tashreef Layen 🤍
            </p>
            <p className="text-[9px] text-gray-400 mt-2 font-mono">
              Powered by Almadel POS Management
            </p>
          </div>
        </div>

        {/* Action Buttons (Hidden on Print) */}
        <div className="mt-6 flex flex-col gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full py-3 px-4 rounded-2xl bg-[#00875a] hover:bg-[#00744e] text-white font-extrabold text-sm shadow-lg shadow-[#00875a]/25 transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <span>🖨️</span>
            <span>Print Receipt</span>
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
              className="flex-1 py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
