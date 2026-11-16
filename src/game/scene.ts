import { W, H, roundRect, seeded } from "./util";

// ---------- ตำแหน่งสิ่งก่อสร้างในฉาก ----------
export const WHEEL = { cx: 300, cy: 318, r: 112, cabins: 10, speed: 0.11 };
export const CAROUSEL = { cx: 438, cy: 610, rx: 86, ry: 26, slots: 8, speed: 0.55 };
export const ARENA = { x: 28, y: 690, w: 330, h: 150 };
export const STAGE = { x: 14, y: 360, w: 168, h: 120 };

// พื้นที่ที่ตัวละครเดินได้
export const ZONES = [
  { x: 24, y: 505, w: 300, h: 135, weight: 6 }, // ลานหน้าเวที
  { x: 380, y: 680, w: 140, h: 175, weight: 3 }, // ทางเดินขวา
  { x: 24, y: 905, w: 496, h: 45, weight: 1 }, // ถนนหน้าร้าน
];

export const STALLS = [
  { x: 18, label: "ไก่ย่าง", c1: "#d9382f", c2: "#f5e6c8" },
  { x: 120, label: "สายไหม", c1: "#e86fa8", c2: "#fff0f7" },
  { x: 222, label: "ปาเป้า", c1: "#2f7bd9", c2: "#e8f2ff" },
  { x: 324, label: "ลูกชิ้น", c1: "#e8a02f", c2: "#fff5e0" },
  { x: 426, label: "ตักปลา", c1: "#2fa86a", c2: "#e6fff2" },
];

export function renderStatic(fontFamily: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  // ท้องฟ้า
  const sky = ctx.createLinearGradient(0, 0, 0, 520);
  sky.addColorStop(0, "#070a24");
  sky.addColorStop(0.6, "#1a1446");
  sky.addColorStop(1, "#3b1d55");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, 520);

  // พระจันทร์
  const moonG = ctx.createRadialGradient(440, 120, 10, 440, 120, 90);
  moonG.addColorStop(0, "rgba(255,240,180,0.35)");
  moonG.addColorStop(1, "rgba(255,240,180,0)");
  ctx.fillStyle = moonG;
  ctx.fillRect(340, 20, 200, 200);
  ctx.fillStyle = "#f6e7a8";
  ctx.beginPath();
  ctx.arc(440, 120, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(190,160,90,0.45)";
  for (const [x, y, r] of [
    [425, 105, 9],
    [455, 130, 7],
    [432, 140, 5],
    [458, 100, 4],
    [415, 128, 4],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // ภูเขา/ต้นไม้ไกล
  ctx.fillStyle = "#140f33";
  ctx.beginPath();
  ctx.moveTo(0, 470);
  for (let x = 0; x <= W; x += 30) ctx.lineTo(x, 440 - Math.sin(x * 0.03) * 12 - (x % 60 === 0 ? 10 : 0));
  ctx.lineTo(W, 520);
  ctx.lineTo(0, 520);
  ctx.fill();

  // เจดีย์/วัดซ้าย-ขวา
  drawChedi(ctx, 110, 455, 1.15);
  drawChedi(ctx, 505, 470, 1.35);
  drawTempleRoof(ctx, 60, 455);

  // พื้น
  const ground = ctx.createLinearGradient(0, 480, 0, H);
  ground.addColorStop(0, "#5a3a4a");
  ground.addColorStop(1, "#3a2630");
  ctx.fillStyle = ground;
  ctx.fillRect(0, 480, W, H - 480);
  // ลายพื้นอิฐ
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  for (let y = 490; y < H; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    for (let x = (y / 16) % 2 ? 0 : 16; x < W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 16);
      ctx.stroke();
    }
  }

  // เวที
  drawStage(ctx, fontFamily);

  // ฐานชิงช้าสวรรค์
  ctx.strokeStyle = "#8a6a9e";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(WHEEL.cx, WHEEL.cy);
  ctx.lineTo(WHEEL.cx - 62, 500);
  ctx.moveTo(WHEEL.cx, WHEEL.cy);
  ctx.lineTo(WHEEL.cx + 62, 500);
  ctx.stroke();
  ctx.fillStyle = "#4c3a5e";
  ctx.fillRect(WHEEL.cx - 80, 496, 160, 10);
  ctx.fillStyle = "#e8c35a";
  ctx.fillRect(WHEEL.cx - 24, 470, 48, 30);
  ctx.fillStyle = "#3a2630";
  ctx.font = `bold 10px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.fillText("ชิงช้า", WHEEL.cx, 489);

  // สนามรถบั๊ม
  const a = ARENA;
  ctx.fillStyle = "#222034";
  roundRect(ctx, a.x - 8, a.y - 8, a.w + 16, a.h + 16, 10);
  ctx.fill();
  ctx.fillStyle = "#3d3a5c";
  ctx.fillRect(a.x, a.y, a.w, a.h);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let x = a.x; x < a.x + a.w; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, a.y);
    ctx.lineTo(x, a.y + a.h);
    ctx.stroke();
  }
  for (let y = a.y; y < a.y + a.h; y += 22) {
    ctx.beginPath();
    ctx.moveTo(a.x, y);
    ctx.lineTo(a.x + a.w, y);
    ctx.stroke();
  }
  // ป้ายสนาม
  ctx.fillStyle = "#151325";
  roundRect(ctx, a.x + 70, a.y - 30, 190, 24, 6);
  ctx.fill();
  ctx.strokeStyle = "#7ef0c8";
  ctx.lineWidth = 2;
  roundRect(ctx, a.x + 70, a.y - 30, 190, 24, 6);
  ctx.stroke();
  ctx.fillStyle = "#7ef0c8";
  ctx.font = `bold 13px ${fontFamily}`;
  ctx.fillText("รถบั๊ม BUMPER CAR", a.x + 165, a.y - 13);

  // ร้านค้า
  for (const s of STALLS) drawStall(ctx, s.x, 838, s.label, s.c1, s.c2, fontFamily);

  // เสาไฟ
  for (const x of [372, 528]) {
    ctx.fillStyle = "#2b2b3a";
    ctx.fillRect(x - 2, 640, 4, 70);
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(x - 6, 632, 12, 10);
  }

  return c;
}

function drawChedi(ctx: CanvasRenderingContext2D, x: number, base: number, s: number) {
  ctx.fillStyle = "#2a1f4a";
  ctx.beginPath();
  ctx.moveTo(x - 34 * s, base);
  ctx.lineTo(x - 22 * s, base - 30 * s);
  ctx.lineTo(x - 12 * s, base - 50 * s);
  ctx.quadraticCurveTo(x, base - 75 * s, x + 12 * s, base - 50 * s);
  ctx.lineTo(x + 22 * s, base - 30 * s);
  ctx.lineTo(x + 34 * s, base);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, base - 66 * s);
  ctx.lineTo(x, base - 130 * s);
  ctx.lineTo(x + 4 * s, base - 66 * s);
  ctx.fill();
  ctx.fillStyle = "rgba(240,190,90,0.55)";
  for (let i = 1; i < 5; i++) ctx.fillRect(x - (30 - i * 5) * s, base - i * 12 * s, (60 - i * 10) * s, 2);
}

function drawTempleRoof(ctx: CanvasRenderingContext2D, x: number, base: number) {
  ctx.fillStyle = "#24193f";
  ctx.beginPath();
  ctx.moveTo(x - 60, base);
  ctx.lineTo(x - 30, base - 40);
  ctx.lineTo(x - 36, base - 46);
  ctx.lineTo(x, base - 70);
  ctx.lineTo(x + 36, base - 46);
  ctx.lineTo(x + 30, base - 40);
  ctx.lineTo(x + 60, base);
  ctx.fill();
  ctx.strokeStyle = "rgba(240,190,90,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 36, base - 46);
  ctx.lineTo(x, base - 70);
  ctx.lineTo(x + 36, base - 46);
  ctx.stroke();
}

function drawStage(ctx: CanvasRenderingContext2D, fontFamily: string) {
  const s = STAGE;
  // โครง truss
  ctx.strokeStyle = "#8d8aa8";
  ctx.lineWidth = 3;
  ctx.strokeRect(s.x, s.y, s.w, s.h);
  ctx.lineWidth = 1;
  for (let x = s.x; x < s.x + s.w; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, s.y);
    ctx.lineTo(x + 12, s.y + 10);
    ctx.moveTo(x + 12, s.y);
    ctx.lineTo(x, s.y + 10);
    ctx.stroke();
  }
  // ฉากหลังเวที
  const bg = ctx.createLinearGradient(0, s.y + 10, 0, s.y + s.h);
  bg.addColorStop(0, "#6b2a7a");
  bg.addColorStop(1, "#2a1a52");
  ctx.fillStyle = bg;
  ctx.fillRect(s.x + 4, s.y + 12, s.w - 8, s.h - 30);
  ctx.fillStyle = "#ffd76a";
  ctx.font = `bold 14px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.fillText("ลูกทุ่งงานวัด", s.x + s.w / 2, s.y + 36);
  // พื้นเวที
  ctx.fillStyle = "#4a2f2a";
  ctx.fillRect(s.x - 4, s.y + s.h - 18, s.w + 8, 22);
  ctx.fillStyle = "#6b463d";
  ctx.fillRect(s.x - 4, s.y + s.h - 18, s.w + 8, 5);
  // ลำโพง
  for (const x of [s.x + 2, s.x + s.w - 22]) {
    ctx.fillStyle = "#1b1b24";
    ctx.fillRect(x, s.y + s.h - 50, 20, 32);
    ctx.fillStyle = "#3b3b4a";
    ctx.beginPath();
    ctx.arc(x + 10, s.y + s.h - 40, 6, 0, Math.PI * 2);
    ctx.arc(x + 10, s.y + s.h - 25, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  c1: string,
  c2: string,
  fontFamily: string,
) {
  const w = 96;
  // ตัวร้าน
  ctx.fillStyle = "#5b3b2a";
  ctx.fillRect(x + 4, y + 22, w - 8, 44);
  ctx.fillStyle = "#7a5238";
  ctx.fillRect(x + 2, y + 50, w - 4, 16);
  // หลังคาลายทาง
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? c2 : c1;
    ctx.beginPath();
    ctx.moveTo(x + i * 12, y + 4);
    ctx.lineTo(x + (i + 1) * 12, y + 4);
    ctx.lineTo(x + (i + 1) * 12, y + 22);
    ctx.arc(x + i * 12 + 6, y + 22, 6, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = c1;
  ctx.fillRect(x, y, w, 5);
  // ของบนร้าน
  const r = seeded(x + 7);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `hsl(${Math.floor(r() * 360)},70%,65%)`;
    ctx.fillRect(x + 10 + i * 13, y + 42, 8, 8);
  }
  // ป้าย
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, x + 18, y + 28, w - 36, 13, 4);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold 9px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + 38);
}

// ---------- ส่วนที่เคลื่อนไหว ----------
type Star = { x: number; y: number; p: number; s: number };
let stars: Star[] = [];
export function initStars() {
  const r = seeded(42);
  stars = Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * 430, p: r() * 6.28, s: r() < 0.15 ? 2 : 1 }));
}

export function drawSkyFx(ctx: CanvasRenderingContext2D, t: number) {
  for (const s of stars) {
    const a = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + s.p));
    ctx.fillStyle = `rgba(255,255,230,${a})`;
    ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
  }
}

export function drawStageFx(ctx: CanvasRenderingContext2D, t: number) {
  const s = STAGE;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const colors = ["255,80,200", "80,200,255", "255,220,80"];
  for (let i = 0; i < 3; i++) {
    const ox = s.x + 30 + i * 55;
    const ang = Math.sin(t * 1.2 + i * 2) * 0.5;
    const g = ctx.createLinearGradient(ox, s.y + 8, ox, s.y + 160);
    g.addColorStop(0, `rgba(${colors[i]},0.45)`);
    g.addColorStop(1, `rgba(${colors[i]},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ox, s.y + 8);
    ctx.lineTo(ox + Math.sin(ang) * 160 - 26, s.y + 170);
    ctx.lineTo(ox + Math.sin(ang) * 160 + 26, s.y + 170);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // ไฟบน truss
  for (let i = 0; i < 12; i++) {
    const on = Math.floor(t * 4 + i) % 3 === 0;
    ctx.fillStyle = on ? "#fff59a" : "#7a6a3a";
    ctx.fillRect(s.x + 6 + i * 13.5, s.y + 2, 4, 4);
  }
}

export function wheelCabinPos(i: number, t: number) {
  const a = t * WHEEL.speed + (i * Math.PI * 2) / WHEEL.cabins;
  return { x: WHEEL.cx + Math.cos(a) * WHEEL.r, y: WHEEL.cy + Math.sin(a) * WHEEL.r, a };
}

export function drawWheel(ctx: CanvasRenderingContext2D, t: number) {
  const { cx, cy, r, cabins } = WHEEL;
  const rot = t * WHEEL.speed;
  // วงล้อ
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#c9b8e8";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  for (let i = 0; i < cabins * 2; i++) {
    const a = rot + (i * Math.PI) / cabins;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  // ไฟวิ่งรอบวง
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const hue = (i * 9 + t * 120) % 360;
    ctx.fillStyle = `hsl(${hue},95%,65%)`;
    ctx.fillRect(cx + Math.cos(a) * r - 1.5, cy + Math.sin(a) * r - 1.5, 3, 3);
  }
  // ดุมกลาง
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6ad6ff";
  ctx.beginPath();
  ctx.arc(cx, cy, 5 + Math.sin(t * 4), 0, Math.PI * 2);
  ctx.fill();
  // กระเช้า
  const cols = ["#e8473c", "#f0b43a", "#4fbf6a", "#3a8be8", "#b45ae8"];
  for (let i = 0; i < cabins; i++) {
    const p = wheelCabinPos(i, t);
    ctx.strokeStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + 6);
    ctx.stroke();
    ctx.fillStyle = cols[i % cols.length];
    roundRect(ctx, p.x - 10, p.y + 6, 20, 15, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,220,0.7)";
    ctx.fillRect(p.x - 7, p.y + 9, 14, 5);
  }
}

export function carouselSlotPos(i: number, t: number) {
  const a = t * CAROUSEL.speed + (i * Math.PI * 2) / CAROUSEL.slots;
  const bob = Math.sin(t * 3 + i * 1.7) * 4;
  return {
    x: CAROUSEL.cx + Math.cos(a) * CAROUSEL.rx,
    y: CAROUSEL.cy + Math.sin(a) * CAROUSEL.ry - 14 + bob,
    depth: Math.sin(a),
  };
}

export function drawCarouselBase(ctx: CanvasRenderingContext2D, t: number) {
  const { cx, cy, rx, ry } = CAROUSEL;
  // ฐาน
  ctx.fillStyle = "#6b2a3a";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8, rx + 14, ry + 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9a35a";
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 14, ry + 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // ไฟรอบฐาน
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ctx.fillStyle = Math.floor(t * 5 + i) % 2 ? "#fff3a0" : "#ff6a6a";
    ctx.fillRect(cx + Math.cos(a) * (rx + 12) - 1.5, cy + 8 + Math.sin(a) * (ry + 8) - 1.5, 3, 3);
  }
  // เสากลาง
  ctx.fillStyle = "#e8d29a";
  ctx.fillRect(cx - 6, cy - 110, 12, 110);
}

export function drawHorse(ctx: CanvasRenderingContext2D, x: number, y: number, i: number, t: number) {
  // เสา
  ctx.fillStyle = "#e8d29a";
  ctx.fillRect(x - 1, cy0() - 108, 2, y - (cy0() - 108));
  const colors = ["#ffffff", "#f7c6d9", "#bfe3ff", "#ffe7a8"];
  ctx.fillStyle = colors[i % colors.length];
  const dir = Math.cos(t * CAROUSEL.speed + (i * Math.PI * 2) / CAROUSEL.slots) > 0 ? -1 : 1;
  ctx.fillRect(x - 10, y, 20, 8); // ตัว
  ctx.fillRect(x + dir * 8, y - 8, 6 * dir, 10); // คอ
  ctx.fillRect(x + dir * 10, y - 10, 7 * dir, 5); // หัว
  ctx.fillRect(x - 8, y + 8, 2, 7);
  ctx.fillRect(x + 6, y + 8, 2, 7);
  ctx.fillStyle = "#c98a3a";
  ctx.fillRect(x - 2, y - 2, 6, 3); // อาน
}
const cy0 = () => CAROUSEL.cy;

export function drawCarouselRoof(ctx: CanvasRenderingContext2D, t: number) {
  const { cx, cy, rx } = CAROUSEL;
  const top = cy - 150;
  const eave = cy - 105;
  const n = 12;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? "#f4ead2" : "#d63b3b";
    const x1 = cx - rx - 18 + ((rx + 18) * 2 * i) / n;
    const x2 = cx - rx - 18 + ((rx + 18) * 2 * (i + 1)) / n;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(x1, eave);
    ctx.lineTo(x2, eave);
    ctx.closePath();
    ctx.fill();
    // ระบาย
    ctx.beginPath();
    ctx.arc((x1 + x2) / 2, eave, (x2 - x1) / 2, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = "#c9a35a";
  ctx.fillRect(cx - rx - 18, eave - 3, (rx + 18) * 2, 5);
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = Math.floor(t * 4 + i) % 2 ? "#fff3a0" : "#ffb347";
    ctx.fillRect(cx - rx - 16 + i * ((rx + 16) * 2 / 15) - 1.5, eave - 2, 3, 3);
  }
  // ยอด
  ctx.fillStyle = "#ffd76a";
  ctx.fillRect(cx - 2, top - 16, 4, 16);
  ctx.beginPath();
  ctx.moveTo(cx, top - 16);
  ctx.lineTo(cx + 14, top - 11);
  ctx.lineTo(cx, top - 6);
  ctx.fill();
}

export function drawStringLights(ctx: CanvasRenderingContext2D, t: number) {
  const lines: [number, number, number, number, number][] = [
    [0, 812, 540, 812, 26],
    [0, 470, 200, 450, 22],
  ];
  for (const [x1, y1, x2, y2, sag] of lines) {
    ctx.strokeStyle = "rgba(20,20,20,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag * 2, x2, y2);
    ctx.stroke();
    const n = 22;
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const x = (1 - u) * (1 - u) * x1 + 2 * (1 - u) * u * ((x1 + x2) / 2) + u * u * x2;
      const y = (1 - u) * (1 - u) * y1 + 2 * (1 - u) * u * ((y1 + y2) / 2 + sag * 2) + u * u * y2;
      const hue = [0, 50, 120, 200, 300][i % 5];
      const on = Math.floor(t * 3 + i) % 4 !== 0;
      ctx.fillStyle = on ? `hsl(${hue},100%,70%)` : `hsl(${hue},50%,30%)`;
      ctx.fillRect(x - 2, y, 4, 5);
    }
  }
  // โคมแดง
  for (const x of [60, 170, 280, 390, 500]) {
    const y = 820 + Math.sin(t * 2 + x) * 2;
    ctx.fillStyle = "#e0322b";
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd76a";
    ctx.fillRect(x - 4, y - 2, 8, 3);
    ctx.fillRect(x - 4, y + 16, 8, 3);
  }
}

export function drawBumperCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  facing: number,
  t: number,
) {
  // ไม้เสา (antenna)
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x, y - 40);
  ctx.stroke();
  if (Math.floor(t * 10) % 3 === 0) {
    ctx.fillStyle = "#9ef";
    ctx.fillRect(x - 1, y - 42, 3, 3);
  }
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.ellipse(x, y + 6, 22, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, 20, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(x - 5 * facing, y - 3, 9, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe";
  ctx.fillRect(x + facing * 16 - 2, y - 1, 4, 3);
}
