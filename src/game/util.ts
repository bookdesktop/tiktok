export const W = 540;
export const H = 960;

export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function truncate(s: string, n: number) {
  const chars = Array.from(s);
  return chars.length > n ? chars.slice(0, n).join("") + "..." : s;
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// แคชรูปโปรไฟล์
const imgCache = new Map<string, HTMLImageElement | null>();
export function getImage(url?: string): HTMLImageElement | null {
  if (!url) return null;
  const cached = imgCache.get(url);
  if (cached !== undefined) return cached && cached.complete && cached.naturalWidth > 0 ? cached : null;
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.onerror = () => imgCache.set(url, null);
  img.src = url;
  imgCache.set(url, img);
  return null;
}
