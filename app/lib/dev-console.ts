/** True in local `next dev`; false in production builds. */
export const isDevEnvironment = process.env.NODE_ENV === "development";

export function devLog(...args: unknown[]): void {
  if (isDevEnvironment) console.log(...args);
}

export function devWarn(...args: unknown[]): void {
  if (isDevEnvironment) console.warn(...args);
}

export function devError(...args: unknown[]): void {
  if (isDevEnvironment) console.error(...args);
}
