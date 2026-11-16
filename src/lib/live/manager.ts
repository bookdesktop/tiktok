import "server-only";
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";
import type { LiveEvent, LiveUser } from "./types";

type Listener = (e: LiveEvent) => void;

type Room = {
  username: string;
  conn: TikTokLiveConnection | null;
  listeners: Set<Listener>;
  lastStatus: LiveEvent | null;
  closeTimer: ReturnType<typeof setTimeout> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  fails: number;
  roomId?: string;
};

// เก็บไว้ใน globalThis เพื่อไม่ให้หลุดเมื่อ hot-reload ตอน dev
const g = globalThis as unknown as { __tiktokRooms?: Map<string, Room> };
const rooms = (g.__tiktokRooms ??= new Map<string, Room>());

/* eslint-disable @typescript-eslint/no-explicit-any */
function pickUrl(pic: any): string | undefined {
  if (!pic) return undefined;
  const list: unknown = pic.url ?? pic.urlList ?? pic.urls;
  if (Array.isArray(list) && typeof list[0] === "string") return list[0];
  if (typeof pic === "string") return pic;
  return undefined;
}

function toUser(u: any): LiveUser {
  return {
    id: String(u?.uniqueId ?? u?.userId ?? "unknown"),
    name: String(u?.nickname || u?.uniqueId || "ผู้ชม"),
    avatar: pickUrl(u?.profilePicture) ?? pickUrl(u?.avatarThumb),
  };
}

function emit(room: Room, e: LiveEvent) {
  if (e.type === "status") room.lastStatus = e;
  for (const l of room.listeners) {
    try {
      l(e);
    } catch {
      /* ignore broken listener */
    }
  }
}

function connect(room: Room) {
  const conn = new TikTokLiveConnection(room.username, {
    signApiKey: process.env.EULER_API_KEY || undefined,
    // ถ้ารู้ Room ID แล้ว ข้ามขั้นดึงข้อมูลห้องที่ TikTok มักบล็อก
    fetchRoomInfoOnConnect: !room.roomId,
    enableExtendedGiftInfo: false,
  } as any);
  room.conn = conn;

  conn.on(WebcastEvent.MEMBER, (d: any) => emit(room, { type: "join", user: toUser(d.user) }));
  conn.on(WebcastEvent.CHAT, (d: any) =>
    emit(room, { type: "chat", user: toUser(d.user), text: String(d.comment ?? "") }),
  );
  conn.on(WebcastEvent.LIKE, (d: any) =>
    emit(room, {
      type: "like",
      user: toUser(d.user),
      count: Number(d.likeCount ?? 1),
      total: d.totalLikeCount != null ? Number(d.totalLikeCount) : undefined,
    }),
  );
  conn.on(WebcastEvent.GIFT, (d: any) => {
    const giftType = d.giftDetails?.giftType;
    if (giftType === 1 && !d.repeatEnd) return; // รอให้ streak จบก่อน
    const count = Number(d.repeatCount || 1);
    const each = Number(d.giftDetails?.diamondCount ?? d.extendedGiftInfo?.diamond_count ?? 1);
    emit(room, {
      type: "gift",
      user: toUser(d.user),
      giftName: String(d.giftDetails?.giftName ?? d.extendedGiftInfo?.name ?? "ของขวัญ"),
      count,
      coins: each * count,
      image: pickUrl(d.giftDetails?.giftImage) ?? pickUrl(d.extendedGiftInfo?.image),
    });
  });
  conn.on(WebcastEvent.FOLLOW, (d: any) => emit(room, { type: "follow", user: toUser(d.user) }));
  conn.on(WebcastEvent.SHARE, (d: any) => emit(room, { type: "share", user: toUser(d.user) }));
  conn.on(WebcastEvent.ROOM_USER, (d: any) =>
    emit(room, { type: "viewers", count: Number(d.viewerCount ?? 0) }),
  );
  conn.on(ControlEvent.DISCONNECTED, () => {
    emit(room, { type: "status", state: "disconnected", message: "หลุดการเชื่อมต่อ กำลังลองใหม่..." });
    scheduleRetry(room);
  });

  emit(room, { type: "status", state: "connecting", message: `กำลังเชื่อมต่อ @${room.username}` });
  conn
    .connect(room.roomId || undefined)
    .then(() => {
      room.fails = 0;
      emit(room, { type: "status", state: "connected", message: `เชื่อมต่อ @${room.username} แล้ว` });
    })
    .catch((err: any) => {
      const subs: string[] = (err?.config?.requestErrs ?? []).map((e: any) => String(e?.message ?? e));
      console.error(`[tiktok] connect @${room.username} failed:`, err?.message, subs);
      const all = [String(err?.message ?? err), ...subs].join(" ");
      let reason = `เชื่อมต่อไม่สำเร็จ: ${err?.message ?? err}`;
      if (/offline|not.*live|UserOffline|user_not_found|LiveRoom/i.test(all))
        reason = `ไม่พบไลฟ์ของ @${room.username} — ยังไม่ได้ LIVE หรือชื่อผู้ใช้ผิด`;
      else if (/blocked|SIGI_STATE|rate/i.test(all)) reason = `TikTok บล็อกการดึงข้อมูลชั่วคราว (ลองใหม่ หรือใส่ EULER_API_KEY)`;
      room.fails++;
      emit(room, { type: "status", state: "error", message: `${reason} · ลองใหม่ใน ${retryDelay(room) / 1000} วิ` });
      scheduleRetry(room);
    });
}

// รอนานขึ้นเรื่อยๆ เพื่อไม่ให้ TikTok บล็อก: 30, 60, 120, 240, 300 วิ
function retryDelay(room: Room) {
  return Math.min(300, 30 * 2 ** Math.max(0, room.fails - 1)) * 1000;
}

function scheduleRetry(room: Room) {
  if (room.retryTimer || room.listeners.size === 0) return;
  room.retryTimer = setTimeout(() => {
    room.retryTimer = null;
    if (room.listeners.size === 0) return;
    room.conn?.removeAllListeners?.();
    room.conn?.disconnect().catch(() => {});
    connect(room);
  }, retryDelay(room));
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function subscribe(rawUsername: string, listener: Listener, rawRoomId?: string): () => void {
  const roomId = rawRoomId?.match(/\d{6,}/)?.[0];
  // รองรับทั้ง "@name", "name" และลิงก์ https://www.tiktok.com/@name/live
  const fromUrl = rawUsername.match(/tiktok\.com\/@([^/?#\s]+)/i)?.[1];
  const username = (fromUrl ?? rawUsername).trim().replace(/^@/, "").replace(/\s+/g, "").toLowerCase();
  let room = rooms.get(username);
  if (!room) {
    room = { username, conn: null, listeners: new Set(), lastStatus: null, closeTimer: null, retryTimer: null, fails: 0 };
    rooms.set(username, room);
  }
  const r = room;
  if (roomId && r.roomId !== roomId) {
    // ได้ Room ID ใหม่ → เชื่อมต่อใหม่ทันที
    r.roomId = roomId;
    r.fails = 0;
    if (r.retryTimer) clearTimeout(r.retryTimer);
    r.retryTimer = null;
    r.conn?.removeAllListeners?.();
    r.conn?.disconnect().catch(() => {});
    r.conn = null;
  }
  if (r.closeTimer) {
    clearTimeout(r.closeTimer);
    r.closeTimer = null;
  }
  r.listeners.add(listener);
  if (r.lastStatus) listener(r.lastStatus);
  if (!r.conn) connect(r);

  return () => {
    r.listeners.delete(listener);
    if (r.listeners.size === 0) {
      // ปิดการเชื่อมต่อถ้าไม่มีหน้าไหนเปิดอยู่เกิน 30 วิ
      r.closeTimer = setTimeout(() => {
        if (r.listeners.size > 0) return;
        if (r.retryTimer) clearTimeout(r.retryTimer);
        r.conn?.removeAllListeners?.();
        r.conn?.disconnect().catch(() => {});
        rooms.delete(r.username);
      }, 30000);
    }
  };
}
