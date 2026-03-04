import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * So sánh theo kiểu Windows: chữ theo thứ tự, số theo giá trị (file1, file2, file10).
 * Dùng để sắp xếp tên file/folder tự nhiên (natural / alphanumeric sort).
 */
export function naturalCompare(a: string, b: string): number {
  const chunkRe = /(\d+|\D+)/g;
  const chunksA = (a.toLowerCase().match(chunkRe) ?? []) as string[];
  const chunksB = (b.toLowerCase().match(chunkRe) ?? []) as string[];
  const len = Math.max(chunksA.length, chunksB.length);
  for (let i = 0; i < len; i++) {
    const ca = chunksA[i] ?? "";
    const cb = chunksB[i] ?? "";
    const numA = /^\d+$/.test(ca) ? parseInt(ca, 10) : NaN;
    const numB = /^\d+$/.test(cb) ? parseInt(cb, 10) : NaN;
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      if (numA !== numB) return numA - numB;
    } else {
      const cmp = ca.localeCompare(cb, undefined, { sensitivity: "base" });
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}
