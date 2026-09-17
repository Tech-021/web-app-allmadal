"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/app/components/workspace-shell";
import ui from "@/app/components/workspace-ui.module.css";

export default function ImeiPage() {
  const router = useRouter();

  return (
    <WorkspaceShell>
      <section className={`${ui.panel} mx-auto mt-8 max-w-2xl text-center`}>
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-[#e6f4ed] text-3xl">📱</div>
        <label>IMEI Management</label>
        <h1 className="mt-2 text-2xl font-extrabold text-gray-900">This Page Is Under Construction</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">
          IMEI management is being prepared. Please return to the previous page or continue to your dashboard.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button type="button" className={ui.secondary} onClick={() => router.back()}>Go Back</button>
          <Link className={ui.primary} href="/dashboard">Go To Dashboard</Link>
        </div>
      </section>
    </WorkspaceShell>
  );
}
