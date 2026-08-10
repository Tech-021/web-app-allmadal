const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("almadel_access_token");
  if (!baseUrl || !token) throw new Error("Your session is not available. Please sign in again.");
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "Request failed. Please try again.");
  return payload as T;
}

export type Product = { id:number; barcode:string; category?:string|null; costPrice:number; imageUrl?:string|null; lowStockThreshold:number; name:string; price:number; qrCode?:string|null; sellingPrice:number; sku?:string|null; stock:number };
export type StaffItem = { user:{ id:number; email:string; fullName:string|null; role:"staff" }; stats:{ products:number; sales:number; stockLogs:number; totalItemsSold:number; totalSales:number } };
