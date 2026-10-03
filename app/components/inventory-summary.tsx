"use client";

import { useMemo } from "react";
import type { Product } from "@/app/lib/api";
import { Money, formatRs } from "@/app/components/figures";
import { Skeleton } from "@/app/components/motion";
import s from "./inventory-summary.module.css";

export type Health = "out" | "low" | "healthy";

/** Stock health of one product, using its own low-stock threshold. */
export function healthOf(p: Pick<Product, "stock" | "lowStockThreshold">): Health {
  const stock = Number(p.stock ?? 0);
  if (stock <= 0) return "out";
  return stock <= Number(p.lowStockThreshold ?? 5) ? "low" : "healthy";
}

/**
 * Stock value at cost, a health bar by count (each key filters the list), and units on hand.
 * Everything is derived from the catalogue the page already loaded.
 */
export function InventorySummary({
  products,
  loading,
  active,
  onFilter,
}: {
  products: Product[];
  loading?: boolean;
  active: Health | null;
  onFilter: (health: Health | null) => void;
}) {
  const inv = useMemo(() => {
    const list = Array.isArray(products) ? products : [];
    let costValue = 0;
    let retailValue = 0;
    let units = 0;
    const counts: Record<Health, number> = { out: 0, low: 0, healthy: 0 };
    const categories = new Set<string>();
    list.forEach((p) => {
      const stock = Math.max(0, Number(p.stock ?? 0));
      units += stock;
      costValue += stock * Number(p.costPrice || 0);
      retailValue += stock * Number(p.sellingPrice || p.price || 0);
      counts[healthOf(p)] += 1;
      categories.add(p.category?.trim() || "Uncategorised");
    });
    return {
      costValue,
      retailValue,
      units,
      counts,
      categories: list.length ? categories.size : 0,
      margin: retailValue > 0 ? (retailValue - costValue) / retailValue : 0,
    };
  }, [products]);

  const toggle = (h: Health) => onFilter(active === h ? null : h);
  const total = products.length;

  return (
    <section className={s.summary} aria-label="Inventory summary">
      <div className={s.sumCell}>
        <span className={s.eyebrow}>Stock value at cost</span>
        {loading && !total ? <Skeleton className="mt-2 h-10 w-48" /> : <Money value={inv.costValue} size="xl" animate className={s.sumFigure} />}
        <span className={s.sumSub}>
          Sells for Rs {formatRs(inv.retailValue)}
          {inv.retailValue > 0 ? ` · ${Math.round(inv.margin * 100)}% margin` : ""}
        </span>
      </div>
      <div className={s.sumCell}>
        <div className={s.sumRow}>
          <span className={s.sumSub}>
            Health · <span className="font-mono">{total}</span> products
          </span>
          <span className={s.sumSub}>by count</span>
        </div>
        <div className={s.healthBar} role="img" aria-label={`${inv.counts.healthy} healthy, ${inv.counts.low} low, ${inv.counts.out} out of stock`}>
          {total === 0 ? (
            <i style={{ flex: 1, background: "var(--sunken)" }} />
          ) : (
            <>
              {inv.counts.healthy > 0 && <i style={{ flex: inv.counts.healthy, background: "var(--brand)", opacity: 0.55 }} />}
              {inv.counts.low > 0 && <i style={{ flex: inv.counts.low, minWidth: 10, background: "var(--warn)" }} />}
              {inv.counts.out > 0 && <i style={{ flex: inv.counts.out, minWidth: 6, background: "var(--neg)" }} />}
            </>
          )}
        </div>
        <div className={s.healthKeys}>
          <button type="button" onClick={() => toggle("healthy")} aria-pressed={active === "healthy"}>
            <b>{inv.counts.healthy}</b> healthy
          </button>
          <button type="button" className={s.keyWarn} onClick={() => toggle("low")} aria-pressed={active === "low"}>
            <b>{inv.counts.low}</b> low — reorder
          </button>
          <button type="button" className={s.keyNeg} onClick={() => toggle("out")} aria-pressed={active === "out"}>
            <b>{inv.counts.out}</b> out of stock
          </button>
        </div>
      </div>
      <div className={s.sumCell}>
        <span className={s.sumSub}>Units on hand</span>
        <span className={s.sumMid}>{inv.units.toLocaleString("en-IN")}</span>
        <span className={s.sumSub}>
          across <span className="font-mono">{inv.categories}</span> {inv.categories === 1 ? "category" : "categories"}
        </span>
      </div>
    </section>
  );
}
