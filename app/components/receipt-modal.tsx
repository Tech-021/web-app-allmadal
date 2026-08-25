"use client";

import React from "react";

export interface ReceiptSale {
  id: string;
  total: number;
  itemsCount: number;
  createdByName?: string;
  createdAt: string;
}

export function ReceiptModal({
  sale,
  onClose,
}: {
  sale: ReceiptSale | null;
  onClose: () => void;
}) {
  if (!sale) return null;

  const invoiceNumber = `#${sale.id.slice(-4).toUpperCase() || "1024"}`;
  const dateFormatted = new Date(sale.createdAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFormatted = new Date(sale.createdAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center bg-black/45 backdrop-blur-xs p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-gray-100 font-sans text-gray-800">
        {/* Receipt Header */}
        <div className="text-center space-y-1 mb-5">
          <div className="inline-grid size-10 place-items-center rounded-2xl bg-[#00875a] text-white font-extrabold mx-auto shadow-md">
            A
          </div>
          <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Almadel</h2>
          <p className="text-[11px] text-gray-500 font-semibold">Store Management</p>
        </div>

        {/* Invoice Title */}
        <div className="border-y border-dashed border-gray-200 py-3 text-center mb-4">
          <p className="text-sm font-extrabold text-gray-900 tracking-wider">INVOICE {invoiceNumber}</p>
          <div className="flex justify-between text-[11px] text-gray-500 font-medium mt-1">
            <span>Date: {dateFormatted}</span>
            <span>Time: {timeFormatted}</span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium text-left mt-0.5">
            Customer: {sale.createdByName || "Store Customer"}
          </p>
        </div>

        {/* Item Breakdown Table */}
        <div className="space-y-2 mb-4 text-xs font-medium">
          <div className="flex justify-between font-bold text-gray-500 text-[10px] border-b pb-1">
            <span>ITEM</span>
            <span>QTY</span>
            <span>TOTAL</span>
          </div>
          <div className="flex justify-between">
            <span>Store Products Order</span>
            <span>{sale.itemsCount || 1}</span>
            <span className="font-bold">Rs. {sale.total.toLocaleString()}</span>
          </div>
        </div>

        {/* Receipt Totals */}
        <div className="border-t border-dashed border-gray-200 pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span className="font-bold">Rs. {sale.total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Discount</span>
            <span className="font-bold text-green-600">Rs. 0</span>
          </div>
          <div className="flex justify-between text-sm font-extrabold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span className="text-[#00875a]">Rs. {sale.total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 pt-1">
            <span>Payment Method</span>
            <span className="font-bold">Cash</span>
          </div>
        </div>

        {/* Shukriya Footer */}
        <div className="text-center mt-6 pt-4 border-t border-dashed border-gray-200">
          <p className="text-sm font-extrabold text-[#00875a]">Shukriya!</p>
          <p className="text-[11px] font-semibold text-gray-500 mt-0.5">Dobara Aane Ka Shukriya 🤍</p>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex-1 rounded-full border border-gray-200 bg-white py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
          >
            🖨️ Print
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-full bg-[#00875a] py-2 text-xs font-extrabold text-white shadow-md hover:bg-[#006b3f] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
