"use client";
import { FormEvent, useEffect, useState } from "react";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api } from "@/app/lib/api";
import { useToast } from "@/app/components/toast-context";
import ui from "@/app/components/workspace-ui.module.css";

type ClosingData = { summary?: { bills?: number; netSales?: number; expectedCash?: number; difference?: number | null }; closing?: { status?: string } | null };

export default function DailyClosingPage() {
  const today = new Date().toISOString().slice(0, 10); const [date, setDate] = useState(today); const [counted, setCounted] = useState(""); const [note, setNote] = useState(""); const [data, setData] = useState<ClosingData | null>(null); const [saving, setSaving] = useState(false); const { showToast } = useToast();
  async function load() { try { setData(await api(`/finance/daily-closings?date=${date}`)); } catch (e) { showToast(e instanceof Error ? e.message : "Could not load closing.", "error"); } }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [date]);
  async function close(e: FormEvent) { e.preventDefault(); setSaving(true); try { await api("/finance/daily-closings/close", { method: "POST", body: JSON.stringify({ date, countedCash: counted, note }) }); showToast("Daily closing completed.", "success"); await load(); } catch (e) { showToast(e instanceof Error ? e.message : "Could not close day.", "error"); } finally { setSaving(false); } }
  const s = data?.summary || {};
  return <WorkspaceShell><div className={ui.head}><div><label>Reconciliation</label><h1>Daily Closing</h1><p>Review business-day activity and reconcile counted cash.</p></div><input className={ui.input} type="date" value={date} onChange={e => setDate(e.target.value)} /></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">{[["Bills", s.bills], ["Net Sales", s.netSales], ["Expected Cash", s.expectedCash], ["Difference", s.difference ?? "—"]].map(([k, v]) => <div className="bg-white border border-gray-200 rounded-2xl p-4" key={String(k)}><span className="text-xs font-bold text-gray-500">{k}</span><strong className="block mt-1 text-xl text-[#00875a]">{typeof v === "number" ? `Rs ${v.toLocaleString()}` : v}</strong></div>)}</div><form className={ui.panel} onSubmit={close}><h2 className="text-base font-extrabold mb-4">{data?.closing?.status === "closed" ? "Day Closed" : "Count Cash"}</h2><div className={ui.formGrid}><div className={ui.field}><label>Counted Cash</label><input className={ui.input} type="number" min="0" required disabled={data?.closing?.status === "closed"} value={counted} onChange={e => setCounted(e.target.value)} /></div><div className={ui.field}><label>Shortage/Excess Note</label><input className={ui.input} disabled={data?.closing?.status === "closed"} value={note} onChange={e => setNote(e.target.value)} /></div></div>{data?.closing?.status !== "closed" && <button style={{ marginTop: 24 }} className={ui.primary} disabled={saving}>{saving ? "Saving..." : "Close Day"}</button>}</form></WorkspaceShell>;
}
