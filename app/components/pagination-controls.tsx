"use client";

import React from "react";
import { useLanguage } from "./language-context";

export interface PaginationControlsProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  itemLabel?: string;
  compact?: boolean;
}

export function PaginationControls({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = "",
  itemLabel = "items",
  compact = false,
}: PaginationControlsProps) {
  const { language } = useLanguage();
  const isUrdu = language === "ur";

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  // Compact layout: tailor-made for dashboard widgets, sidebars, and cards
  if (compact) {
    return (
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-[var(--muted)] ${className}`}
      >
        {/* Left: compact counter + optional mini per-page select */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11.5px] text-[var(--muted)] whitespace-nowrap tabular-nums">
            {isUrdu ? (
              <>
                <strong>{totalItems}</strong> mein se <strong>{startItem}–{endItem}</strong>
              </>
            ) : (
              <>
                <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong> {itemLabel}
              </>
            )}
          </span>

          {onPageSizeChange && (
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Items per page"
              className="h-6 min-h-6 px-1 text-[11.5px] font-medium bg-[var(--surface)] border border-[var(--border)] rounded-md text-[var(--text-2)] outline-none focus:border-[var(--brand)] cursor-pointer"
              title={isUrdu ? "Har safha" : "Per page"}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Right: compact chevron buttons + page indicator */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            aria-label="Previous Page"
            className="size-7 min-h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] disabled:opacity-30 text-[var(--text-2)] transition-colors flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            <span className="text-sm leading-none select-none">‹</span>
          </button>

          <span className="px-2 py-0.5 text-[11.5px] font-medium text-[var(--text)] tabular-nums min-w-[28px] text-center select-none">
            {safePage} / {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            aria-label="Next Page"
            className="size-7 min-h-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] disabled:opacity-30 text-[var(--text-2)] transition-colors flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
          >
            <span className="text-sm leading-none select-none">›</span>
          </button>
        </div>
      </div>
    );
  }

  // Generate page numbers with ellipsis for full table layout
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safePage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (safePage >= totalPages - 3) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = safePage - 1; i <= safePage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[var(--border)] text-xs font-medium text-[var(--text-2)] ${className}`}
    >
      {/* Left: Summary and Page Size */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[var(--muted)] whitespace-nowrap tabular-nums">
          {isUrdu ? (
            <>
              Kul <strong>{totalItems}</strong> mein se <strong>{startItem}–{endItem}</strong> {itemLabel}
            </>
          ) : (
            <>
              Showing <strong>{startItem}–{endItem}</strong> of <strong>{totalItems}</strong> {itemLabel}
            </>
          )}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[11.5px] text-[var(--muted)] whitespace-nowrap">{isUrdu ? "Har safha:" : "Per page:"}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 min-h-8 px-2 text-xs font-medium bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--text)] outline-none focus:border-[var(--brand)] cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Previous Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Previous Page"
          className="h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] disabled:opacity-40 text-[var(--text)] font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
        >
          <span>‹</span>
          <span className="hidden sm:inline">{isUrdu ? "Peechla" : "Previous"}</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => {
            if (p === "...") {
              return (
                <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-[var(--faint)]">
                  ...
                </span>
              );
            }
            const pageNum = Number(p);
            const isActive = pageNum === safePage;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`min-w-8 h-8 min-h-8 px-2 rounded-lg font-medium text-xs tabular-nums transition-colors cursor-pointer flex items-center justify-center ${
                  isActive
                    ? "bg-[var(--text)] text-[var(--surface)]"
                    : "border border-transparent text-[var(--text-2)] hover:border-[var(--border)] hover:bg-[var(--surface)]"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          aria-label="Next Page"
          className="h-8 px-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] disabled:opacity-40 text-[var(--text)] font-medium transition-colors flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">{isUrdu ? "Agla" : "Next"}</span>
          <span>›</span>
        </button>
      </div>
    </div>
  );
}
