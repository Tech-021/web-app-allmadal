"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import { api, StaffItem } from "@/app/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useBusiness } from "@/app/components/business-context";
import { useToast } from "@/app/components/toast-context";
import { logActivity } from "@/app/lib/logger";
import { PaginationControls } from "@/app/components/pagination-controls";
import ui from "@/app/components/workspace-ui.module.css";
import ob from "@/app/components/onboarding.module.css";
import { Icon } from "@/app/components/icons";
import { Metric, MetricStrip, PageHeader, TableEmptyRow, TableSkeletonRows } from "@/app/components/page-layout";
import { canManageStore } from "@/app/lib/access";

type Draft = { fullName: string; email: string; password: string; confirm: string; role: "staff" | "accountant" };
const blank: Draft = { fullName: "", email: "", password: "", confirm: "", role: "staff" };

const money = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

export default function StaffPage() {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();
  const router = useRouter();
  const { showToast, confirmDialog } = useToast();
  const [staff, setStaff] = useState<StaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<null | { item?: StaffItem }>(null);
  const [draft, setDraft] = useState(blank);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStaff((await api<{ staff: StaffItem[] }>("/admin/staff")).staff);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load team members.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast, activeBusiness?.id]);

  useEffect(() => {
    if (user && !canManageStore(activeBusiness?.membershipRole)) router.replace("/dashboard");
  }, [user, activeBusiness?.membershipRole, router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRealtimeEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ event?: string }>).detail;
      if (detail?.event === "staff.created" || detail?.event === "staff.updated" || detail?.event === "staff.deleted") {
        void load();
      }
    };
    window.addEventListener("almadel_realtime_event", onRealtimeEvent);
    return () => window.removeEventListener("almadel_realtime_event", onRealtimeEvent);
  }, [load]);

  const totals = useMemo(
    () =>
      staff.reduce(
        (a, x) => ({
          sales: a.sales + x.stats.totalSales,
          items: a.items + x.stats.totalItemsSold,
          staffCount: a.staffCount + (x.user.role === "staff" ? 1 : 0),
          accountantCount: a.accountantCount + (x.user.role === "accountant" ? 1 : 0),
        }),
        { sales: 0, items: 0, staffCount: 0, accountantCount: 0 }
      ),
    [staff]
  );

  const open = (item?: StaffItem) => {
    setDraft(
      item
        ? {
            fullName: item.user.fullName ?? "",
            email: item.user.email,
            password: "",
            confirm: "",
            role: item.user.role === "accountant" ? "accountant" : "staff",
          }
        : blank
    );
    setModal({ item });
    setError("");
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.fullName.trim() || !draft.email.includes("@")) {
      const msg = "Enter a valid full name and email address.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if ((!modal?.item || draft.password) && draft.password.length < 8) {
      const msg = "Password must contain at least 8 characters.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    if (draft.password !== draft.confirm) {
      const msg = "Passwords do not match.";
      setError(msg);
      showToast(msg, "error");
      return;
    }
    setSaving(true);
    try {
      const body = {
        fullName: draft.fullName.trim(),
        email: draft.email.trim(),
        role: draft.role,
        ...(draft.password ? { password: draft.password } : {}),
      };
      await api(modal?.item ? `/admin/staff/${modal.item.user.id}` : "/admin/staff", {
        method: modal?.item ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setModal(null);
      const roleLabel = draft.role === "accountant" ? "Accountant" : "Staff member";
      const msg = modal?.item
        ? draft.password
          ? `${roleLabel} updated & credentials emailed.`
          : `${roleLabel} updated successfully.`
        : `${roleLabel} created successfully! Credentials emailed to ${draft.email}.`;
      setNotice(msg);
      showToast(msg, "success");


      logActivity(
        modal?.item ? "STAFF_UPDATE" : "STAFF_CREATE",
        "Staff",
        modal?.item
          ? `Updated ${draft.role} account for '${draft.fullName}' (${draft.email})`
          : `Created new ${draft.role} account for '${draft.fullName}' (${draft.email})`,
        draft.fullName || draft.email,
        { email: draft.email, fullName: draft.fullName, role: draft.role }
      );

      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save team member.";
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: StaffItem) {
    const name = item.user.fullName ?? item.user.email;
    const roleLabel = item.user.role === "accountant" ? "accountant" : "staff";
    const confirmed = await confirmDialog({
      title: `Delete ${item.user.role === "accountant" ? "Accountant" : "Staff"} Account`,
      message: `Are you sure you want to delete the ${roleLabel} account for "${name}"? Their past transactions will remain recorded in reports.`,
      confirmLabel: "Delete Account",
      danger: true,
    });
    if (!confirmed) return;

    try {
      await api(`/admin/staff/${item.user.id}`, { method: "DELETE" });
      const msg = `${item.user.role === "accountant" ? "Accountant" : "Staff"} account for "${name}" deleted.`;
      setNotice(msg);
      showToast(msg, "success");

      logActivity(
        "STAFF_DELETE",
        "Staff",
        `Deleted ${roleLabel} account for '${name}' (${item.user.email})`,
        name,
        { userId: item.user.id, email: item.user.email, role: item.user.role }
      );

      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not delete team member.";
      setError(msg);
      showToast(msg, "error");
    }
  }

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const shown = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return staff;
    return staff.filter((item) =>
      [item.user.fullName, item.user.email, item.user.role].some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      )
    );
  }, [staff, query]);

  const paginatedShown = useMemo(() => {
    const start = (page - 1) * pageSize;
    return shown.slice(start, start + pageSize);
  }, [shown, page, pageSize]);

  return (
    <WorkspaceShell>
      <PageHeader
        eyebrow="Team"
        title="Staff & permissions"
        description="Add counter staff for POS, and accountants for books, balance sheets and reports."
        actions={
          <button className={ui.primary} onClick={() => open()}>
            <Icon name="plus" size={15} />
            Add team member
          </button>
        }
      />

      {error && (
        <div className={ui.error} role="alert">
          <Icon name="alert" size={15} className="mt-px shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div className={ui.notice} role="status">
          <Icon name="check" size={15} className="mt-px shrink-0" />
          {notice}
        </div>
      )}

      <MetricStrip>
        <Metric label="Staff members" icon="users" value={totals.staffCount.toLocaleString()} hint="POS counter access" />
        <Metric label="Accountants" icon="wallet" value={totals.accountantCount.toLocaleString()} hint="Financial books access" />
        <Metric label="Staff sales" icon="pkr" tone="pos" value={money(totals.sales)} hint="Total through staff counters" />
        <Metric label="Items sold" icon="box" value={Number(totals.items || 0).toLocaleString()} hint="By staff members" />
      </MetricStrip>

      <section className={`${ui.panel} ${ui.panelFlush}`}>
        <div className={ui.panelHead}>
          <input
            className={`${ui.input} ${ui.search} max-w-[440px]`}
            placeholder="Search by name, email or role…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            aria-label="Search team members"
          />
          <button className={ui.iconButton} onClick={() => void load()} aria-label="Refresh" title="Refresh">
            <Icon name="refresh" size={15} />
          </button>
        </div>
        <div className={`${ui.tableWrap} ${ui.tableBare}`}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th className="text-right">Total sales</th>
                <th className="text-right">Orders</th>
                <th className="text-right">Items sold</th>
                <th className="text-right">Avg. sale</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !staff.length ? (
                <TableSkeletonRows cols={7} rows={3} />
              ) : !shown.length ? (
                <TableEmptyRow
                  colSpan={7}
                  icon="users"
                  title={query ? "No team members match your search" : "No team members yet"}
                  body={query ? "Try a different name, email or role." : "Invite staff to run the counter, or an accountant to manage your books."}
                  action={
                    !query && (
                      <button className={ui.primary} onClick={() => open()}>
                        <Icon name="plus" size={15} />
                        Add team member
                      </button>
                    )
                  }
                />
              ) : (
                paginatedShown.map((item) => {
                  const name = item.user.fullName || "Unnamed member";
                  const initial = name[0]?.toUpperCase() || "M";
                  const isAccountant = item.user.role === "accountant";
                  return (
                    <tr key={item.user.id}>
                      <td>
                        <div className={ui.productCell}>
                          <span
                            className={`grid size-9 shrink-0 place-items-center rounded-[10px] text-[13px] font-semibold ${
                              isAccountant ? "bg-[var(--info-soft)] text-[var(--info)]" : "bg-[var(--brand-soft)] text-[var(--brand-ink)]"
                            }`}
                          >
                            {initial}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate font-medium">{name}</span>
                            <span className="block truncate text-[12px] text-[var(--muted)]">{item.user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className={`${ui.chip} ${isAccountant ? ui.chipInfo : ""}`}>
                            <Icon name={isAccountant ? "wallet" : "cart"} size={11} />
                            {isAccountant ? "Accountant" : "Staff"}
                          </span>
                          <span className={`${ui.chip} ${ui.chipPos}`}>
                            <span className="size-1.5 rounded-full bg-current" />
                            Active
                          </span>
                        </div>
                      </td>
                      <td className="text-right font-mono font-medium">
                        {isAccountant ? <span className="font-sans font-normal text-[12px] text-[var(--faint)]">Financials only</span> : money(item.stats.totalSales)}
                      </td>
                      <td className="text-right font-mono">{isAccountant ? <span className="text-[var(--faint)]">—</span> : item.stats.sales}</td>
                      <td className="text-right font-mono">{isAccountant ? <span className="text-[var(--faint)]">—</span> : item.stats.totalItemsSold}</td>
                      <td className="text-right font-mono text-[var(--text-2)]">
                        {isAccountant ? <span className="text-[var(--faint)]">—</span> : money(item.stats.sales ? item.stats.totalSales / item.stats.sales : 0)}
                      </td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          <button className={`${ui.secondary} ${ui.btnSm}`} onClick={() => open(item)}>
                            <Icon name="edit" size={13} />
                            Edit
                          </button>
                          <button className={`${ui.iconButton} hover:!text-[var(--neg)]`} onClick={() => void remove(item)} aria-label={`Delete ${name}`} title="Delete">
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {shown.length > 0 && (
          <PaginationControls
            currentPage={page}
            totalItems={shown.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[5, 10, 25, 50]}
            itemLabel="team members"
          />
        )}
      </section>

      {modal && (
        <div
          className={ui.modal}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <form className={ui.sheet} onSubmit={submit} role="dialog" aria-modal="true" aria-label={modal.item ? "Edit team member" : "Add team member"}>
            <div className={ui.sheetHead}>
              <div className="flex items-center gap-2.5">
                <span className={ui.iconTile}>
                  <Icon name={modal.item ? "edit" : "users"} size={15} />
                </span>
                <h2>{modal.item ? "Edit team member" : "Add team member"}</h2>
              </div>
              <button type="button" className={ui.iconButton} onClick={() => setModal(null)} aria-label="Close">
                <Icon name="x" size={15} />
              </button>
            </div>

            <div className="mb-5">
              <div className={ui.notice}>
                <Icon name="mail" size={15} className="mt-px shrink-0" />
                {modal.item
                  ? "If the password is changed, the updated login details are emailed to this member."
                  : "Login details are emailed to the member automatically."}
              </div>
            </div>

            <div className={ui.formGrid}>
              <div className={`${ui.field} ${ui.span2}`}>
                <span className="text-[12.5px] font-medium text-[var(--text-2)]" id="staff-role-label">
                  Role & access
                </span>
                <div className={`${ob.choices} ${ob.choices2}`} role="radiogroup" aria-labelledby="staff-role-label">
                  {(
                    [
                      { id: "staff", icon: "cart", title: "Staff", body: "Sales counter & POS only" },
                      { id: "accountant", icon: "wallet", title: "Accountant", body: "Accounts, balance sheets & reports" },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={draft.role === r.id}
                      onClick={() => setDraft({ ...draft, role: r.id })}
                      className={`${ob.choice} ${ob.choiceCompact} ${draft.role === r.id ? ob.choiceOn : ""}`}
                    >
                      <Icon name={r.icon} size={17} />
                      <span className="flex flex-col">
                        <strong>{r.title}</strong>
                        <span>{r.body}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Full name">
                <input className={ui.input} placeholder="e.g. Ali Ahmed" value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} required />
              </Field>
              <Field label="Email address">
                <input className={ui.input} type="email" placeholder="ali@company.com" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required />
              </Field>
              <Field label={modal.item ? "New password (blank keeps current)" : "Password"}>
                <input className={ui.input} type="password" placeholder="Minimum 8 characters" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
              </Field>
              <Field label="Confirm password">
                <input className={ui.input} type="password" placeholder="Re-enter password" value={draft.confirm} onChange={(e) => setDraft({ ...draft, confirm: e.target.value })} />
              </Field>
            </div>
            <div className={ui.formActions}>
              <button type="button" className={ui.secondary} onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className={ui.primary} disabled={saving}>
                {saving ? "Saving…" : modal.item ? "Save changes" : "Add member"}
              </button>
            </div>
          </form>
        </div>
      )}
    </WorkspaceShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={ui.field}>
      <label>{label}</label>
      {children}
    </div>
  );
}

