import type { SVGProps } from "react";

/** Almadel stroke icon set (24px grid, 1.6 stroke). Presentation only. */
const PATHS = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  cart: "M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.7a1 1 0 0 0 1-.8L21 8H6.2M9 20.5h.01M18 20.5h.01",
  box: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  tag: "M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7l8.8 8.8-9.2 9.2zM7.5 7.5h.01",
  layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
  wallet: "M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3M3 7.5V18a2 2 0 0 0 2 2h15V9H5.5A2.5 2.5 0 0 1 3 7.5zM16.5 14.5h.01",
  users: "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  truck: "M1 5h13v11H1zM14 9h4l3 3.5V16h-7M5.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  expense: "M5 3h14v18l-2.5-1.6L14 21l-2-1.6L10 21l-2.5-1.6L5 21zM9 8h6M9 12h6M9 16h3",
  phone: "M8 2h8a1.5 1.5 0 0 1 1.5 1.5v17A1.5 1.5 0 0 1 16 22H8a1.5 1.5 0 0 1-1.5-1.5v-17A1.5 1.5 0 0 1 8 2zM11 18.5h2",
  card: "M2.5 5.5h19v13h-19zM2.5 10h19M6.5 15h4",
  invoice: "M14 2.5H6.5v19h11V6zM14 2.5V6h3.5M9.5 11h5M9.5 15h5",
  lock: "M5 11h14v10H5zM8 11V7.5a4 4 0 0 1 8 0V11M12 15v2",
  chart: "M3 3v18h18M7 15l4-4 3 3 5-6",
  staff: "M12 2.5l7.5 3V11c0 4.8-3.2 8.6-7.5 10.5C7.7 19.6 4.5 15.8 4.5 11V5.5zM12 11a2.3 2.3 0 1 0 0-4.6 2.3 2.3 0 0 0 0 4.6zM8.5 15.5c.9-1.3 2.1-1.9 3.5-1.9s2.6.6 3.5 1.9",
  logs: "M22 12h-4l-3 8L9 4l-3 8H2",
  settings: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1.5 14h5M9.5 8h5M17.5 16h5",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  bell: "M6 8.5a6 6 0 1 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15 6 8.5M10.2 20.5a2 2 0 0 0 3.6 0",
  scan: "M3 7.5V5a2 2 0 0 1 2-2h2.5M16.5 3H19a2 2 0 0 1 2 2v2.5M21 16.5V19a2 2 0 0 1-2 2h-2.5M7.5 21H5a2 2 0 0 1-2-2v-2.5M7 8v8M10 8v8M13.5 8v8M17 8v8",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  x: "M18 6L6 18M6 6l12 12",
  down: "M6 9l6 6 6-6",
  right: "M9 6l6 6-6 6",
  left: "M15 6l-6 6 6 6",
  updown: "M7 9l5-5 5 5M7 15l5 5 5-5",
  upright: "M7 17L17 7M8 7h9v9",
  downright: "M7 7l10 10M17 8v9H8",
  moon: "M20.5 13.2A8.5 8.5 0 1 1 10.8 3.5a6.6 6.6 0 0 0 9.7 9.7z",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  check: "M20 6L9 17l-5-5",
  dots: "M12 12.5h.01M19 12.5h.01M5 12.5h.01",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM4 14h6v6H4z",
  home: "M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  panel: "M3 4h18v16H3zM9 4v16",
  logout: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3",
  store: "M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6",
  alert: "M12 3l9.5 17h-19zM12 10v4M12 17.5h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  shield: "M12 2.5l7.5 3V11c0 4.8-3.2 8.6-7.5 10.5C7.7 19.6 4.5 15.8 4.5 11V5.5zM9 12l2 2 4-4",
  download: "M12 3v12M7 10l5 5 5-5M4 20h16",
  upload: "M12 21V9M7 14l5-5 5 5M4 4h16",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 7.5h.01",
  camera: "M3 8.5A1.5 1.5 0 0 1 4.5 7h2.8l1.7-2.5h6l1.7 2.5h2.8A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  trash: "M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3",
  pkr: "M4 4h6.5a4 4 0 0 1 0 8H4l9 8M4 8h12",
  refresh: "M20 11a8 8 0 0 0-14.5-4.5L3 9M3 4v5h5M4 13a8 8 0 0 0 14.5 4.5L21 15M21 20v-5h-5",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  command: "M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z",
  printer: "M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z",
  edit: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16zM13.5 6.5l4 4",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  calendar: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4",
  bank: "M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18",
  zap: "M13 2L4 14h7l-1 8 9-12h-7z",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  file: "M14 3H6v18h12V7zM14 3v4h4",
  filter: "M3 5h18l-7 8.5V20l-4-2v-4.5z",
  receipt: "M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6",
  user: "M20 21v-1.5a4.5 4.5 0 0 0-4.5-4.5h-7A4.5 4.5 0 0 0 4 19.5V21M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  key: "M15.5 8.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM14.5 11.5L21 18v3h-3v-2h-2v-2h-2l-1.6-1.6",
  image: "M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6M15.5 9h.01",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  database: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  coins: "M9 10c3.3 0 6-1.1 6-2.5S12.3 5 9 5 3 6.1 3 7.5 5.7 10 9 10zM3 7.5v4C3 12.9 5.7 14 9 14s6-1.1 6-2.5v-4M9 18c-3.3 0-6-1.1-6-2.5v-4M15 14.3c3.4-.2 6-1.3 6-2.6v-4c0-1.3-2.4-2.3-5.6-2.5M15 18.3c3.4-.2 6-1.3 6-2.6v-4",
} as const;

export type IconName = keyof typeof PATHS;

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & {
  name: IconName;
  size?: number;
  strokeWidth?: number;
};

export function Icon({ name, size = 16, strokeWidth = 1.6, className, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flex: "none" }}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Icon for a workspace route (falls back to the dashboard glyph). */
export const ROUTE_ICONS: Record<string, IconName> = {
  "/dashboard": "dashboard",
  "/sales": "cart",
  "/products": "box",
  "/categories": "tag",
  "/stock": "layers",
  "/accounts": "wallet",
  "/customers": "users",
  "/suppliers": "truck",
  "/expenses": "expense",
  "/imei": "phone",
  "/payments": "card",
  "/invoices": "invoice",
  "/daily-closing": "lock",
  "/reports": "chart",
  "/staff": "staff",
  "/logs": "logs",
  "/settings": "settings",
};

export function routeIcon(href: string): IconName {
  return ROUTE_ICONS[href] ?? "dashboard";
}

/** Almadel brand mark: an arch "A" on a jade tile. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: "none" }}>
      <defs>
        <linearGradient id="almadel-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16A07A" />
          <stop offset="1" stopColor="#0A5E48" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="url(#almadel-mark)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="none" stroke="rgba(255,255,255,.18)" />
      <path d="M9.5 23V14.5a6.5 6.5 0 0 1 13 0V23" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12.6 18.4h6.8" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
