import { Product } from "@/app/lib/api";

export interface OfflineQueuedSale {
  id: string;
  offlineInvoiceNumber: string;
  businessId: number | string;
  payload: any;
  receiptPreview: any;
  createdAt: string;
  retryCount: number;
}

const POS_CACHE_PREFIX = "almadel_pos_cache_";
const OFFLINE_QUEUE_PREFIX = "almadel_offline_sales_queue_";

/**
 * Checks if the browser currently has active internet connectivity
 */
export function isBrowserOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

/**
 * Caches products and customers locally for offline POS browsing & barcode scanning
 */
export function savePosCache(
  businessId: number | string,
  products: Product[],
  customers: any[]
): void {
  if (typeof window === "undefined" || !businessId) return;
  try {
    const data = {
      products,
      customers,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${POS_CACHE_PREFIX}${businessId}`, JSON.stringify(data));
  } catch (err) {
    console.warn("Failed to cache POS data locally:", err);
  }
}

/**
 * Retrieves locally cached products and customers when offline
 */
export function getPosCache(
  businessId: number | string
): { products: Product[]; customers: any[]; cachedAt: string } | null {
  if (typeof window === "undefined" || !businessId) return null;
  try {
    const raw = localStorage.getItem(`${POS_CACHE_PREFIX}${businessId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("Failed to read POS cache:", err);
    return null;
  }
}

/**
 * Decrements local stock for products sold while offline so local inventory stays accurate
 */
export function updateCachedProductStock(
  businessId: number | string,
  deductions: Array<{ productId: number; quantity: number }>
): void {
  if (typeof window === "undefined" || !businessId) return;
  try {
    const cache = getPosCache(businessId);
    if (!cache) return;

    const deductionMap = new Map<number, number>();
    for (const d of deductions) {
      deductionMap.set(d.productId, (deductionMap.get(d.productId) || 0) + d.quantity);
    }

    const updatedProducts = cache.products.map((p) => {
      const sold = deductionMap.get(Number(p.id));
      if (sold) {
        return {
          ...p,
          stock: Math.max(0, Number(p.stock || 0) - sold),
        };
      }
      return p;
    });

    savePosCache(businessId, updatedProducts, cache.customers);
  } catch (err) {
    console.warn("Failed to update cached product stock:", err);
  }
}

/**
 * Retrieves the list of sales completed offline waiting to be synchronized
 */
export function getPendingOfflineSales(businessId: number | string): OfflineQueuedSale[] {
  if (typeof window === "undefined" || !businessId) return [];
  try {
    const raw = localStorage.getItem(`${OFFLINE_QUEUE_PREFIX}${businessId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Generates an offline invoice number and queues the sale for cloud synchronization
 */
export function recordOfflineSale(
  businessId: number | string,
  payload: any,
  receiptPreview: any
): OfflineQueuedSale {
  const queue = getPendingOfflineSales(businessId);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  const offlineInvoiceNumber = `OFF-${dateStr}-${rand}`;

  // Attach offline metadata to payload so backend records accurate creation time
  const enrichedPayload = {
    ...payload,
    offlineInvoiceNumber,
    offlineCreatedAt: now.toISOString(),
  };

  const offlineSale: OfflineQueuedSale = {
    id: `local_${now.getTime()}_${rand}`,
    offlineInvoiceNumber,
    businessId,
    payload: enrichedPayload,
    receiptPreview: {
      ...receiptPreview,
      invoiceNumber: offlineInvoiceNumber,
      isOffline: true,
    },
    createdAt: now.toISOString(),
    retryCount: 0,
  };

  queue.push(offlineSale);
  localStorage.setItem(`${OFFLINE_QUEUE_PREFIX}${businessId}`, JSON.stringify(queue));

  // Deduct local product stock immediately
  if (Array.isArray(payload.items)) {
    updateCachedProductStock(
      businessId,
      payload.items.map((i: any) => ({
        productId: Number(i.productId),
        quantity: Number(i.quantity || 1),
      }))
    );
  }

  // Notify system of queue change
  window.dispatchEvent(
    new CustomEvent("almadel_offline_queue_updated", {
      detail: { businessId, count: queue.length },
    })
  );

  return offlineSale;
}

/**
 * Synchronizes all pending offline sales with the backend API
 */
export async function syncOfflineSales(
  businessId: number | string,
  apiCaller: (endpoint: string, options?: any) => Promise<any>
): Promise<{ synced: number; failed: number; total: number }> {
  if (typeof window === "undefined" || !businessId || !navigator.onLine) {
    return { synced: 0, failed: 0, total: 0 };
  }

  const queue = getPendingOfflineSales(businessId);
  if (queue.length === 0) {
    return { synced: 0, failed: 0, total: 0 };
  }

  let synced = 0;
  let failed = 0;
  const remainingQueue: OfflineQueuedSale[] = [];

  for (const sale of queue) {
    try {
      await apiCaller("/sales/checkout", {
        method: "POST",
        body: JSON.stringify(sale.payload),
      });
      synced += 1;
    } catch (err) {
      console.error(`Failed to sync offline sale ${sale.offlineInvoiceNumber}:`, err);
      sale.retryCount = (sale.retryCount || 0) + 1;
      remainingQueue.push(sale);
      failed += 1;
    }
  }

  localStorage.setItem(`${OFFLINE_QUEUE_PREFIX}${businessId}`, JSON.stringify(remainingQueue));

  window.dispatchEvent(
    new CustomEvent("almadel_offline_queue_updated", {
      detail: { businessId, count: remainingQueue.length },
    })
  );

  if (synced > 0) {
    window.dispatchEvent(
      new CustomEvent("almadel_offline_sync_success", {
        detail: { businessId, synced, remaining: remainingQueue.length },
      })
    );
  }

  return { synced, failed, total: queue.length };
}

/**
 * Event listener helper to track browser online/offline status
 */
export function listenConnectionStatus(onChange: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
