import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | number | Date): string {
  let d: Date;
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === "number") {
    d = new Date(date < 1e12 ? date * 1000 : date);
  } else if (typeof date === "string" && /^\d+(\.\d+)?$/.test(date)) {
    const n = parseFloat(date);
    d = new Date(n < 1e12 ? n * 1000 : n);
  } else {
    d = new Date(date);
  }
  return format(d, "MMM d, yyyy HH:mm");
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "MMM d, yyyy");
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatRelativeShort(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffS = Math.floor(diffMs / 1000);
  if (diffS < 5) return "just now";
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
