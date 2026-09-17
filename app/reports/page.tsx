"use client";
import { useEffect, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import ui from "@/app/components/workspace-ui.module.css";
export default function ReportsPage() { const [r, setR] = useState<any>(null); const { showToast } = useToast(); useEffect(() => { void api("/finance/reports/summary").then(setR).catch(e => showToast(e.message, "error")); }, [showToast]); const cards = [["Sales", r?.sales?.total], ["Expenses", r?.expenses], ["Receivables", r?.customers?.receivable], ["Payables", r?.suppliers?.payable], ["Customers", r?.customers?.count], ["Suppliers", r?.suppliers?.count]]; return <WorkspaceShell><div className={ui.head}><div><label>Business intelligence</label><h1>Reports</h1><p>Server-aggregated financial and operational summary for the active business.</p></div></div><div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{cards.map(([k, v]) => <div className="bg-white border border-gray-200 rounded-2xl p-5" key={String(k)}><span className="text-xs font-bold text-gray-500">{k}</span><strong className="block mt-2 text-2xl text-[#00875a]">{r ? (typeof v === "number" ? (String(k).includes("count") ? v : `Rs ${v.toLocaleString()}`) : "0") : "…"}</strong></div>)}</div></WorkspaceShell>; }
