import type { LiveEvent, LiveUser } from "@/lib/live/types";
import { W, H, hash, seeded, rand, pick, clamp, truncate, roundRect, getImage } from "./util";
import {
  WHEEL,
  CAROUSEL,
  ARENA,
  STAGE,
  ZONES,
  renderStatic,
  initStars,
  drawSkyFx,
  drawStageFx,
  drawWheel,
  wheelCabinPos,
  drawCarouselBase,
  carouselSlotPos,
  drawHorse,
  drawCarouselRoof,
  drawStringLights,
  drawBumperCar,
} from "./scene";

type State = "walk" | "idle" | "toWheel" | "wheel" | "toCarousel" | "carousel" | "toCar" | "car" | "dance";

type Char = {
  id: string;
  name: string;
  avatar?: string;
  isPlayer: boolean;
  x: number;
  y: number;
  tx: number;
  ty: number;
  speed: number;
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  hairStyle: number;
  state: State;
  until: number;
  slot: number;
  facing: number;
  phase: number;
  chat: { text: string; until: number } | null;
  lastActive: number;
  glowUntil: number;
  likes: number;
  coins: number;
};

type Car = { x: number; y: number; vx: number; vy: number; color: string; rider: string | null; facing: number };

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  kind: "heart" | "spark" | "note" | "text" | "rocket";
  color: string;
  text?: string;
  size?: number;
};

export type Ranked = { id: string; name: string; avatar?: string; coins: number };

export type HudState = {
  leaderboard: Ranked[];
  vip: Ranked | null;
  lastDonate: { name: string; avatar?: string; giftName: string; count: number; image?: string } | null;
  viewers: number;
  totalLikes: number;
  players: number;
  status: { state: string; message?: string };
};

export type FeedItem = {
  kind: "join" | "gift" | "follow" | "share" | "chat";
  text: string;
  avatar?: string;
  image?: string;
  name?: string;
  gift?: string;
  count?: number;
};

export type GameOptions = {
  fontFamily: string;
  npcCount?: number;
  idleMinutes?: number;
  maxPlayers?: number;
  onHud?: (h: HudState) => void;
  onFeed?: (f: FeedItem) => void;
};

const SKINS = ["#f6d2b0", "#e8b894", "#c98e64", "#a8714a", "#f3c9a0"];
const HAIRS = ["#1b1410", "#3a2414", "#6b4320", "#d9b25a", "#a33a2a", "#f2f2f2", "#5a3a8a"];
const SHIRTS = ["#e84a4a", "#4a8be8", "#f2c94c", "#5ac46a", "#ffffff", "#b46ae8", "#ff8fb8", "#3ad6c9", "#f28a3a", "#2d2d3a"];
const PANTS = ["#2b3a6b", "#1c1c24", "#5b4636", "#3d5a3a", "#6b6b78"];
const CAR_COLORS = ["#e8433a", "#3a8be8", "#f2c230", "#42c467", "#e85ac8", "#ff8a3a"];
const NPC_NAMES = Array.from({ length: 40 }, (_, i) => `npc${i}`);

export class Game {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private chars = new Map<string, Char>();
  private cars: Car[] = [];
  private particles: Particle[] = [];
  private cabins: (string | null)[] = Array(WHEEL.cabins).fill(null);
  private horses: (string | null)[] = Array(CAROUSEL.slots).fill(null);
  private t = 0;
  private last = 0;
  private raf = 0;
  private opts: Required<Omit<GameOptions, "onHud" | "onFeed">> & Pick<GameOptions, "onHud" | "onFeed">;
  private hud: HudState = {
    leaderboard: [],
    vip: null,
    lastDonate: null,
    viewers: 0,
    totalLikes: 0,
    players: 0,
    status: { state: "idle" },
  };
  private ranking = new Map<string, Ranked>();
  private hudDirty = true;
  private hudTimer = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    options: GameOptions,
  ) {
    this.opts = { npcCount: 16, idleMinutes: 15, maxPlayers: 120, ...options };
    this.ctx = canvas.getContext("2d")!;
    this.bg = renderStatic(this.opts.fontFamily);
    initStars();
    for (let i = 0; i < this.opts.npcCount; i++) this.spawnNpc(i);
    for (let i = 0; i < 3; i++) this.spawnCar(null);
  }

  start() {
    const loop = (now: number) => {
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
      this.last = now;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  // ---------------- events ----------------
  handle(e: LiveEvent) {
    switch (e.type) {
      case "status":
        this.hud.status = { state: e.state, message: e.message };
        this.hudDirty = true;
        break;
      case "viewers":
        this.hud.viewers = e.count;
        this.hudDirty = true;
        break;
      case "join": {
        const isNew = !this.chars.has(e.user.id);
        this.ensurePlayer(e.user);
        if (isNew) this.opts.onFeed?.({ kind: "join", text: `${e.user.name} เข้าร่วมแล้ว`, avatar: e.user.avatar });
        break;
      }
      case "chat": {
        const c = this.ensurePlayer(e.user);
        const text = e.text.trim();
        this.command(c, text);
        c.chat = { text: truncate(text, 40), until: this.t + 6 };
        break;
      }
      case "like": {
        const c = this.ensurePlayer(e.user);
        c.likes += e.count;
        this.hud.totalLikes = e.total ?? this.hud.totalLikes + e.count;
        this.hudDirty = true;
        const p = this.headPos(c);
        for (let i = 0; i < Math.min(e.count, 6); i++) {
          this.particles.push({
            x: p.x + rand(-8, 8),
            y: p.y - 30,
            vx: rand(-15, 15),
            vy: rand(-60, -35),
            life: 0,
            max: rand(1.2, 2),
            kind: "heart",
            color: pick(["#ff4d6d", "#ff8fab", "#ff2e63"]),
          });
        }
        break;
      }
      case "follow": {
        const c = this.ensurePlayer(e.user);
        this.floatText(c, "+ติดตาม", "#7ef0c8");
        this.opts.onFeed?.({ kind: "follow", text: `${e.user.name} ติดตามแล้ว ❤`, avatar: e.user.avatar, name: e.user.name });
        break;
      }
      case "share": {
        const c = this.ensurePlayer(e.user);
        this.floatText(c, "แชร์!", "#ffd76a");
        this.opts.onFeed?.({ kind: "share", text: `${e.user.name} แชร์ไลฟ์`, avatar: e.user.avatar });
        break;
      }
      case "gift": {
        const c = this.ensurePlayer(e.user);
        c.coins += e.coins;
        c.glowUntil = this.t + 10 + Math.min(60, e.coins);
        const r = this.ranking.get(c.id) ?? { id: c.id, name: c.name, avatar: c.avatar, coins: 0 };
        r.coins += e.coins;
        r.name = c.name;
        r.avatar = c.avatar;
        this.ranking.set(c.id, r);
        this.hud.lastDonate = { name: c.name, avatar: c.avatar, giftName: e.giftName, count: e.count, image: e.image };
        this.recomputeRanking();
        this.floatText(c, `🎁 ${e.giftName} x${e.count}`, "#ffd76a");
        this.sparkle(c, 24);
        if (e.coins >= 30) this.fireworks(Math.min(8, 1 + Math.floor(e.coins / 30)));
        // คนให้ของขวัญได้เล่นเครื่องเล่นทันที
        if (c.state === "walk" || c.state === "idle") this.goActivity(c, pick(["toWheel", "toCarousel", "toCar"] as const));
        this.opts.onFeed?.({
          kind: "gift",
          text: `${c.name} ส่ง ${e.giftName} x${e.count}`,
          name: c.name,
          gift: e.giftName,
          count: e.count,
          avatar: c.avatar,
          image: e.image,
        });
        break;
      }
    }
  }

  private command(c: Char, text: string) {
    const s = text.toLowerCase();
    if (s === "1" || s.includes("ชิงช้า")) this.goActivity(c, "toWheel");
    else if (s === "2" || s.includes("ม้า")) this.goActivity(c, "toCarousel");
    else if (s === "3" || s.includes("รถ") || s.includes("บั๊ม")) this.goActivity(c, "toCar");
    else if (s === "4" || s.includes("เต้น")) this.goActivity(c, "dance");
  }

  private recomputeRanking() {
    const list = [...this.ranking.values()].sort((a, b) => b.coins - a.coins);
    this.hud.leaderboard = list.slice(0, 10);
    this.hud.vip = list[0] ?? null;
    this.hudDirty = true;
  }

  // ---------------- spawning ----------------
  private makeChar(id: string, name: string, isPlayer: boolean, avatar?: string): Char {
    const r = seeded(hash(id));
    const z = this.randomPoint();
    return {
      id,
      name,
      avatar,
      isPlayer,
      x: z.x,
      y: z.y,
      tx: z.x,
      ty: z.y,
      speed: rand(28, 42),
      skin: SKINS[Math.floor(r() * SKINS.length)],
      hair: HAIRS[Math.floor(r() * HAIRS.length)],
      shirt: SHIRTS[Math.floor(r() * SHIRTS.length)],
      pants: PANTS[Math.floor(r() * PANTS.length)],
      hairStyle: Math.floor(r() * 3),
      state: "walk",
      until: 0,
      slot: -1,
      facing: 1,
      phase: r() * 10,
      chat: null,
      lastActive: this.t,
      glowUntil: 0,
      likes: 0,
      coins: 0,
    };
  }

  private spawnNpc(i: number) {
    const id = NPC_NAMES[i % NPC_NAMES.length] + "_" + i;
    this.chars.set(id, this.makeChar(id, "", false));
  }

  private spawnCar(rider: string | null) {
    const car: Car = {
      x: rand(ARENA.x + 30, ARENA.x + ARENA.w - 30),
      y: rand(ARENA.y + 20, ARENA.y + ARENA.h - 15),
      vx: rand(-60, 60),
      vy: rand(-40, 40),
      color: pick(CAR_COLORS),
      rider,
      facing: 1,
    };
    this.cars.push(car);
    return car;
  }

  private ensurePlayer(u: LiveUser): Char {
    let c = this.chars.get(u.id);
    if (!c) {
      c = this.makeChar(u.id, u.name, true, u.avatar);
      this.chars.set(u.id, c);
      this.sparkle(c, 16);
      this.enforceCap();
      this.hud.players = this.playerCount();
      this.hudDirty = true;
    } else {
      if (u.avatar) c.avatar = u.avatar;
      if (u.name) c.name = u.name;
    }
    c.lastActive = this.t;
    return c;
  }

  private playerCount() {
    let n = 0;
    for (const c of this.chars.values()) if (c.isPlayer) n++;
    return n;
  }

  private enforceCap() {
    const players = [...this.chars.values()].filter((c) => c.isPlayer);
    if (players.length <= this.opts.maxPlayers) return;
    players.sort((a, b) => a.lastActive - b.lastActive);
    for (const c of players.slice(0, players.length - this.opts.maxPlayers)) this.removeChar(c);
  }

  private removeChar(c: Char) {
    this.leaveRide(c);
    this.chars.delete(c.id);
  }

  private randomPoint() {
    const total = ZONES.reduce((s, z) => s + z.weight, 0);
    let r = Math.random() * total;
    for (const z of ZONES) {
      r -= z.weight;
      if (r <= 0) return { x: rand(z.x, z.x + z.w), y: rand(z.y, z.y + z.h), zone: z };
    }
    const z = ZONES[0];
    return { x: rand(z.x, z.x + z.w), y: rand(z.y, z.y + z.h), zone: z };
  }

  private nearPoint(c: Char) {
    // ส่วนใหญ่เดินในโซนเดิม
    const zone = ZONES.find((z) => c.x >= z.x - 5 && c.x <= z.x + z.w + 5 && c.y >= z.y - 5 && c.y <= z.y + z.h + 5);
    if (zone && Math.random() < 0.8) {
      return {
        x: clamp(c.x + rand(-120, 120), zone.x, zone.x + zone.w),
        y: clamp(c.y + rand(-50, 50), zone.y, zone.y + zone.h),
      };
    }
    return this.randomPoint();
  }

  // ---------------- activities ----------------
  private goActivity(c: Char, s: "toWheel" | "toCarousel" | "toCar" | "dance") {
    this.leaveRide(c);
    c.state = s;
    if (s === "toWheel") {
      c.tx = WHEEL.cx + rand(-14, 14);
      c.ty = 512;
    } else if (s === "toCarousel") {
      c.tx = CAROUSEL.cx + rand(-20, 20);
      c.ty = 655;
    } else if (s === "toCar") {
      c.tx = 372;
      c.ty = rand(720, 800);
    } else {
      c.tx = rand(STAGE.x + 20, STAGE.x + STAGE.w - 10);
      c.ty = rand(505, 530);
      c.until = 0;
    }
  }

  private leaveRide(c: Char) {
    if (c.state === "wheel" && c.slot >= 0) {
      this.cabins[c.slot] = null;
      c.x = WHEEL.cx + rand(-20, 20);
      c.y = 515;
    } else if (c.state === "carousel" && c.slot >= 0) {
      this.horses[c.slot] = null;
      c.x = CAROUSEL.cx + rand(-30, 30);
      c.y = 660;
    } else if (c.state === "car") {
      const car = this.cars.find((k) => k.rider === c.id);
      if (car) {
        car.rider = null;
        c.x = 372;
        c.y = clamp(car.y, 700, 840);
      }
      // ลดรถเปล่าไม่ให้เยอะเกิน
      const empty = this.cars.filter((k) => !k.rider);
      if (this.cars.length > 4 && empty.length > 0) this.cars.splice(this.cars.indexOf(empty[0]), 1);
    }
    c.slot = -1;
  }

  private finishRide(c: Char) {
    this.leaveRide(c);
    c.state = "walk";
    const p = this.randomPoint();
    c.tx = p.x;
    c.ty = p.y;
  }

  // ---------------- update ----------------
  private update(dt: number) {
    this.t += dt;
    const t = this.t;

    for (const c of this.chars.values()) {
      c.phase += dt;
      if (c.chat && c.chat.until < t) c.chat = null;

      switch (c.state) {
        case "walk":
        case "toWheel":
        case "toCarousel":
        case "toCar":
        case "dance": {
          if (c.state === "dance" && c.until > 0) {
            if (t > c.until) this.finishRide(c);
            else if (Math.random() < dt * 1.5) this.note(c);
            break;
          }
          const dx = c.tx - c.x;
          const dy = c.ty - c.y;
          const d = Math.hypot(dx, dy);
          if (d < 2) this.arrive(c);
          else {
            const sp = c.speed * (c.state === "walk" ? 1 : 1.6);
            c.x += (dx / d) * sp * dt;
            c.y += (dy / d) * sp * dt;
            if (Math.abs(dx) > 1) c.facing = dx > 0 ? 1 : -1;
          }
          break;
        }
        case "idle":
          if (t > c.until) {
            const r = Math.random();
            if (r < 0.06) this.goActivity(c, "toWheel");
            else if (r < 0.12) this.goActivity(c, "toCarousel");
            else if (r < 0.16) this.goActivity(c, "toCar");
            else if (r < 0.2) this.goActivity(c, "dance");
            else {
              const p = this.nearPoint(c);
              c.tx = p.x;
              c.ty = p.y;
              c.state = "walk";
            }
          }
          break;
        case "wheel": {
          const p = wheelCabinPos(c.slot, t);
          c.x = p.x;
          c.y = p.y + 18;
          if (t > c.until) this.finishRide(c);
          break;
        }
        case "carousel": {
          const p = carouselSlotPos(c.slot, t);
          c.x = p.x;
          c.y = p.y;
          if (t > c.until) this.finishRide(c);
          break;
        }
        case "car": {
          const car = this.cars.find((k) => k.rider === c.id);
          if (!car) {
            this.finishRide(c);
            break;
          }
          c.x = car.x;
          c.y = car.y;
          if (t > c.until) this.finishRide(c);
          break;
        }
      }

      // ลบผู้เล่นที่ไม่ active
      if (c.isPlayer && t - c.lastActive > this.opts.idleMinutes * 60 && c.glowUntil < t) {
        this.removeChar(c);
        this.hud.players = this.playerCount();
        this.hudDirty = true;
      }
    }

    this.updateCars(dt);
    this.updateParticles(dt);

    this.hudTimer -= dt;
    if (this.hudDirty && this.hudTimer <= 0) {
      this.hudDirty = false;
      this.hudTimer = 0.25;
      this.opts.onHud?.({ ...this.hud, leaderboard: this.hud.leaderboard.map((r) => ({ ...r })) });
    }
  }

  private arrive(c: Char) {
    const t = this.t;
    switch (c.state) {
      case "walk":
        c.state = "idle";
        c.until = t + rand(1, 5);
        break;
      case "toWheel": {
        // เลือกกระเช้าว่างที่อยู่ใกล้ด้านล่างที่สุด
        let best = -1;
        let bestD = 1e9;
        for (let i = 0; i < this.cabins.length; i++) {
          if (this.cabins[i]) continue;
          const p = wheelCabinPos(i, t);
          const d = Math.abs(p.y - (WHEEL.cy + WHEEL.r)) + Math.abs(p.x - WHEEL.cx);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
        if (best < 0) {
          c.state = "idle";
          c.until = t + 3;
          return;
        }
        this.cabins[best] = c.id;
        c.slot = best;
        c.state = "wheel";
        c.until = t + (Math.PI * 2) / WHEEL.speed * 0.6;
        break;
      }
      case "toCarousel": {
        const free = this.horses.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
        if (!free.length) {
          c.state = "idle";
          c.until = t + 3;
          return;
        }
        const s = pick(free);
        this.horses[s] = c.id;
        c.slot = s;
        c.state = "carousel";
        c.until = t + rand(18, 26);
        break;
      }
      case "toCar": {
        const riders = this.cars.filter((k) => k.rider).length;
        if (riders >= 8) {
          c.state = "idle";
          c.until = t + 3;
          return;
        }
        const empty = this.cars.find((k) => !k.rider);
        const car = empty ?? this.spawnCar(null);
        car.rider = c.id;
        c.state = "car";
        c.until = t + rand(18, 28);
        break;
      }
      case "dance":
        c.until = t + rand(6, 10);
        break;
    }
  }

  private updateCars(dt: number) {
    const minX = ARENA.x + 22;
    const maxX = ARENA.x + ARENA.w - 22;
    const minY = ARENA.y + 14;
    const maxY = ARENA.y + ARENA.h - 12;
    for (const k of this.cars) {
      // บังคับเลี้ยวสุ่ม
      if (Math.random() < dt * 0.8) {
        k.vx += rand(-50, 50);
        k.vy += rand(-30, 30);
      }
      const sp = Math.hypot(k.vx, k.vy);
      const target = 70;
      if (sp > 0) {
        k.vx = (k.vx / sp) * (sp + (target - sp) * dt);
        k.vy = (k.vy / sp) * (sp + (target - sp) * dt) * 0.8;
      }
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      if (k.x < minX) {
        k.x = minX;
        k.vx = Math.abs(k.vx);
      }
      if (k.x > maxX) {
        k.x = maxX;
        k.vx = -Math.abs(k.vx);
      }
      if (k.y < minY) {
        k.y = minY;
        k.vy = Math.abs(k.vy);
      }
      if (k.y > maxY) {
        k.y = maxY;
        k.vy = -Math.abs(k.vy);
      }
      if (Math.abs(k.vx) > 5) k.facing = k.vx > 0 ? 1 : -1;
    }
    for (let i = 0; i < this.cars.length; i++)
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        const dx = b.x - a.x;
        const dy = (b.y - a.y) * 1.8;
        const d = Math.hypot(dx, dy);
        if (d < 38 && d > 0) {
          const nx = dx / d;
          const ny = dy / d;
          const push = (38 - d) / 2;
          a.x -= nx * push;
          b.x += nx * push;
          a.y -= (ny * push) / 1.8;
          b.y += (ny * push) / 1.8;
          [a.vx, b.vx] = [b.vx, a.vx];
          [a.vy, b.vy] = [b.vy, a.vy];
          if (Math.random() < 0.5)
            this.particles.push({
              x: (a.x + b.x) / 2,
              y: (a.y + b.y) / 2 - 10,
              vx: 0,
              vy: -30,
              life: 0,
              max: 0.6,
              kind: "text",
              color: "#fff",
              text: pick(["ปึ้ก!", "โป๊ก!", "บั๊ม!"]),
              size: 11,
            });
        }
      }
  }

  private updateParticles(dt: number) {
    const out: Particle[] = [];
    for (const p of this.particles) {
      p.life += dt;
      if (p.kind === "rocket") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life >= p.max) {
          this.burst(p.x, p.y, p.color);
          continue;
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === "spark") {
          p.vy += 60 * dt;
          p.vx *= 0.98;
        }
        if (p.kind === "heart") p.vx += Math.sin(p.life * 6) * 10 * dt;
      }
      if (p.life < p.max) out.push(p);
    }
    this.particles = out.length > 900 ? out.slice(out.length - 900) : out;
  }

  // ---------------- effects ----------------
  private headPos(c: Char) {
    return { x: c.x, y: c.y - 32 };
  }

  private floatText(c: Char, text: string, color: string) {
    const p = this.headPos(c);
    this.particles.push({ x: p.x, y: p.y - 60, vx: 0, vy: -22, life: 0, max: 2.4, kind: "text", color, text, size: 13 });
  }

  private sparkle(c: Char, n: number) {
    const p = this.headPos(c);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(30, 90);
      this.particles.push({
        x: p.x,
        y: p.y - 20,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 30,
        life: 0,
        max: rand(0.6, 1.2),
        kind: "spark",
        color: pick(["#ffd76a", "#fff", "#ff9ef0", "#9ef0ff"]),
      });
    }
  }

  private note(c: Char) {
    this.particles.push({
      x: c.x + rand(-10, 10),
      y: c.y - 40,
      vx: rand(-10, 10),
      vy: -30,
      life: 0,
      max: 1.4,
      kind: "note",
      color: pick(["#ffd76a", "#9ef0ff", "#ff9ef0"]),
    });
  }

  fireworks(n: number) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x: rand(60, 480),
        y: 520,
        vx: rand(-20, 20),
        vy: rand(-380, -300),
        life: -i * 0.35,
        max: rand(0.9, 1.2),
        kind: "rocket",
        color: pick(["#ff5a5a", "#ffd76a", "#7ef0c8", "#9ab8ff", "#ff9ef0"]),
      });
    }
  }

  private burst(x: number, y: number, color: string) {
    for (let i = 0; i < 50; i++) {
      const a = (i / 50) * Math.PI * 2;
      const s = rand(60, 130);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0,
        max: rand(1, 1.6),
        kind: "spark",
        color,
      });
    }
  }

  // ---------------- render ----------------
  resize(cssW: number, cssH: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.ctx.setTransform((cssW * dpr) / W, 0, 0, (cssH * dpr) / H, 0, 0);
  }

  private render() {
    const ctx = this.ctx;
    const t = this.t;
    const F = this.opts.fontFamily;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bg, 0, 0, W, H);
    drawSkyFx(ctx, t);
    drawStageFx(ctx, t);
    drawWheel(ctx, t);

    // ม้าหมุน: ด้านหลังก่อน แล้วค่อยด้านหน้า
    drawCarouselBase(ctx, t);
    const slots = Array.from({ length: CAROUSEL.slots }, (_, i) => ({ i, ...carouselSlotPos(i, t) })).sort(
      (a, b) => a.depth - b.depth,
    );
    for (const s of slots) {
      drawHorse(ctx, s.x, s.y, s.i, t);
      const rid = this.horses[s.i];
      const c = rid ? this.chars.get(rid) : undefined;
      if (c) this.drawFigure(c, s.x, s.y + 2, t, "sit");
    }
    drawCarouselRoof(ctx, t);

    // วาดตัวละครบนพื้นและรถ เรียงตามแกน y
    type D = { y: number; draw: () => void };
    const list: D[] = [];
    for (const c of this.chars.values()) {
      if (c.state === "wheel" || c.state === "carousel" || c.state === "car") continue;
      list.push({ y: c.y, draw: () => this.drawFigure(c, c.x, c.y, t, c.state === "dance" && c.until > 0 ? "dance" : "walk") });
    }
    for (const k of this.cars) {
      list.push({
        y: k.y,
        draw: () => {
          drawBumperCar(ctx, k.x, k.y, k.color, k.facing, t);
          const c = k.rider ? this.chars.get(k.rider) : undefined;
          if (c) this.drawFigure(c, k.x, k.y - 2, t, "sit");
        },
      });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    drawStringLights(ctx, t);
    this.drawParticles();

    // ป้ายชื่อ + รูปโปรไฟล์ ไว้ด้านบนสุดเพื่อให้อ่านง่าย
    const players = [...this.chars.values()].filter((c) => c.isPlayer).sort((a, b) => a.y - b.y);
    const vipId = this.hud.vip?.id;
    for (const c of players) this.drawTag(c, t, F, c.id === vipId);
  }

  private drawFigure(c: Char, x: number, y: number, t: number, pose: "walk" | "sit" | "dance") {
    const ctx = this.ctx;
    const u = 2;
    const moving = c.state !== "idle" && pose === "walk" && Math.hypot(c.tx - c.x, c.ty - c.y) > 2;
    const step = moving ? Math.sin(c.phase * 10) : 0;
    let by = y;
    if (pose === "dance") by -= Math.abs(Math.sin(c.phase * 6)) * 6;
    const X = Math.round(x);
    const Y = Math.round(by);

    if (c.isPlayer && c.glowUntil > t) {
      const g = ctx.createRadialGradient(X, Y - 14, 2, X, Y - 14, 26);
      g.addColorStop(0, "rgba(255,215,106,0.55)");
      g.addColorStop(1, "rgba(255,215,106,0)");
      ctx.fillStyle = g;
      ctx.fillRect(X - 26, Y - 40, 52, 52);
    }

    if (pose !== "sit") {
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.beginPath();
      ctx.ellipse(X, y + 1, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // ขา
      ctx.fillStyle = c.pants;
      ctx.fillRect(X - 3 * u + (step > 0 ? 1 : 0), Y - 5 * u, 2 * u, 5 * u - (step > 0.3 ? 2 : 0));
      ctx.fillRect(X + 1 * u - (step < 0 ? 1 : 0), Y - 5 * u, 2 * u, 5 * u - (step < -0.3 ? 2 : 0));
      ctx.fillStyle = "#222";
      ctx.fillRect(X - 3 * u, Y - 1 * u, 2 * u, u);
      ctx.fillRect(X + 1 * u, Y - 1 * u, 2 * u, u);
    }
    const top = pose === "sit" ? Y - 6 * u : Y - 5 * u;
    // ตัว
    ctx.fillStyle = c.pants;
    ctx.fillRect(X - 3 * u, top - 2 * u, 6 * u, 2 * u);
    ctx.fillStyle = c.shirt;
    ctx.fillRect(X - 3 * u, top - 7 * u, 6 * u, 5 * u);
    // แขน
    const arm = pose === "dance" ? Math.sin(c.phase * 8) : step;
    ctx.fillStyle = c.shirt;
    if (pose === "dance") {
      ctx.fillRect(X - 4 * u, top - 10 * u + (arm > 0 ? 0 : 2), u, 4 * u);
      ctx.fillRect(X + 3 * u, top - 10 * u + (arm > 0 ? 2 : 0), u, 4 * u);
      ctx.fillStyle = c.skin;
      ctx.fillRect(X - 4 * u, top - 11 * u + (arm > 0 ? 0 : 2), u, u);
      ctx.fillRect(X + 3 * u, top - 11 * u + (arm > 0 ? 2 : 0), u, u);
    } else {
      ctx.fillRect(X - 4 * u, top - 7 * u + Math.round(arm), u, 4 * u);
      ctx.fillRect(X + 3 * u, top - 7 * u - Math.round(arm), u, 4 * u);
      ctx.fillStyle = c.skin;
      ctx.fillRect(X - 4 * u, top - 3 * u + Math.round(arm), u, u);
      ctx.fillRect(X + 3 * u, top - 3 * u - Math.round(arm), u, u);
    }
    // หัว
    ctx.fillStyle = c.skin;
    ctx.fillRect(X - 3 * u, top - 12 * u, 6 * u, 5 * u);
    ctx.fillStyle = "#1b1410";
    ctx.fillRect(X + (c.facing > 0 ? 0 : -2 * u), top - 10 * u, u, u);
    ctx.fillRect(X + (c.facing > 0 ? 2 * u : 0) - u, top - 10 * u, u, u);
    // ผม
    ctx.fillStyle = c.hair;
    ctx.fillRect(X - 3 * u, top - 13 * u, 6 * u, 2 * u);
    if (c.hairStyle === 1) ctx.fillRect(X - 3 * u - (c.facing > 0 ? 1 : -5 * u), top - 12 * u, u, 4 * u);
    if (c.hairStyle === 2) {
      ctx.fillRect(X - 4 * u, top - 12 * u, u, 5 * u);
      ctx.fillRect(X + 3 * u, top - 12 * u, u, 5 * u);
    }
  }

  private drawTag(c: Char, t: number, F: string, vip: boolean) {
    const ctx = this.ctx;
    let ax = c.x;
    let ay = c.y - (c.state === "carousel" || c.state === "car" ? 36 : 30);
    if (c.state === "wheel") {
      ay = c.y - 14;
    }
    ax = Math.round(ax);
    ay = Math.round(ay);
    const S = c.state === "wheel" ? 26 : 32;
    const bx = ax - S / 2;
    const byy = ay - S - 8;

    // ฟองรูปโปรไฟล์
    ctx.fillStyle = vip ? "#ffd76a" : "#ffffff";
    roundRect(ctx, bx - 3, byy - 3, S + 6, S + 6, 9);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(ax - 5, byy + S + 2);
    ctx.lineTo(ax + 5, byy + S + 2);
    ctx.lineTo(ax, byy + S + 8);
    ctx.fill();
    const img = getImage(c.avatar);
    ctx.save();
    roundRect(ctx, bx, byy, S, S, 7);
    ctx.clip();
    if (img) {
      ctx.drawImage(img, bx, byy, S, S);
    } else {
      ctx.fillStyle = `hsl(${hash(c.id) % 360},60%,55%)`;
      ctx.fillRect(bx, byy, S, S);
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.round(S * 0.5)}px ${F}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(Array.from(c.name)[0]?.toUpperCase() ?? "?", ax, byy + S / 2 + 1);
    }
    ctx.restore();

    // มงกุฎ VIP
    if (vip) {
      ctx.fillStyle = "#ffcc00";
      const cy = byy - 12 + Math.sin(t * 3) * 1.5;
      ctx.beginPath();
      ctx.moveTo(ax - 9, cy + 8);
      ctx.lineTo(ax - 9, cy);
      ctx.lineTo(ax - 4, cy + 4);
      ctx.lineTo(ax, cy - 2);
      ctx.lineTo(ax + 4, cy + 4);
      ctx.lineTo(ax + 9, cy);
      ctx.lineTo(ax + 9, cy + 8);
      ctx.closePath();
      ctx.fill();
    }

    // ชื่อ
    const level = 1 + Math.floor(Math.sqrt(c.likes / 15));
    const label = truncate(c.name, 10);
    ctx.font = `bold 11px ${F}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const ny = byy - (vip ? 16 : 6);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.strokeText(label, ax, ny);
    ctx.fillStyle = vip ? "#ffe27a" : "#ffffff";
    ctx.fillText(label, ax, ny);
    if (level > 1) {
      const w = ctx.measureText(label).width;
      ctx.font = `bold 8px ${F}`;
      ctx.fillStyle = "#ff4d8d";
      roundRect(ctx, ax + w / 2 + 2, ny - 9, 20, 10, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(`Lv${level}`, ax + w / 2 + 12, ny - 1);
    }

    // ข้อความแชท
    if (c.chat) {
      ctx.font = `12px ${F}`;
      const lines = wrap(ctx, c.chat.text, 130);
      const lw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14;
      const lh = lines.length * 15 + 8;
      const cx = clamp(ax - lw / 2, 4, W - lw - 4);
      const cy = ny - 14 - lh;
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      roundRect(ctx, cx, cy, lw, lh, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ax - 4, cy + lh);
      ctx.lineTo(ax + 4, cy + lh);
      ctx.lineTo(ax, cy + lh + 5);
      ctx.fill();
      ctx.fillStyle = "#222";
      ctx.textAlign = "left";
      lines.forEach((l, i) => ctx.fillText(l, cx + 7, cy + 16 + i * 15));
    }
  }

  private drawParticles() {
    const ctx = this.ctx;
    const F = this.opts.fontFamily;
    for (const p of this.particles) {
      if (p.life < 0) continue;
      const a = clamp(1 - p.life / p.max, 0, 1);
      ctx.globalAlpha = p.kind === "rocket" ? 1 : a;
      ctx.fillStyle = p.color;
      switch (p.kind) {
        case "heart": {
          const s = 2;
          const x = Math.round(p.x);
          const y = Math.round(p.y);
          ctx.fillRect(x - 3 * s, y - 2 * s, 2 * s, 2 * s);
          ctx.fillRect(x + s, y - 2 * s, 2 * s, 2 * s);
          ctx.fillRect(x - 3 * s, y, 6 * s, 2 * s);
          ctx.fillRect(x - 2 * s, y + 2 * s, 4 * s, s);
          ctx.fillRect(x - s, y + 3 * s, 2 * s, s);
          break;
        }
        case "spark":
        case "rocket":
          ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
          if (p.kind === "rocket") {
            ctx.fillStyle = "rgba(255,220,150,0.6)";
            ctx.fillRect(p.x - 1, p.y + 3, 2, 8);
          }
          break;
        case "note":
          ctx.font = `bold 14px ${F}`;
          ctx.textAlign = "center";
          ctx.fillText("♪", p.x, p.y);
          break;
        case "text":
          ctx.font = `bold ${p.size ?? 12}px ${F}`;
          ctx.textAlign = "center";
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.strokeText(p.text ?? "", p.x, p.y);
          ctx.fillText(p.text ?? "", p.x, p.y);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (ctx.measureText(line + ch).width > max && line) {
      out.push(line);
      line = ch;
    } else line += ch;
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}
