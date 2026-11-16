"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Game, type FeedItem, type HudState } from "@/game/engine";
import { startDemo } from "@/game/demo";
import { Music } from "@/game/music";
import { Voice } from "@/game/voice";
import type { LiveEvent } from "@/lib/live/types";
import { kanit } from "../fonts";

type Toast = FeedItem & { id: number };

const DEFAULT_TITLE = "พาตัวละครไปเล่นเครื่องเล่นได้เลยจ้า 🎡 พิมพ์ 1 ชิงช้า · 2 ม้าหมุน · 3 รถบั๊ม · 4 เต้น";
const DEFAULT_WELCOME = "🎡 ยินดีต้อนรับสู่งานวัด Pixel Live! แค่เข้ามาดูตัวละครก็เดินเข้างานได้เลย 🌹 ส่งกุหลาบจุดพลุ + อัปเลเวล";

export default function LiveGame() {
  const params = useSearchParams();
  const username = params.get("u") ?? "";
  const roomId = params.get("room") ?? "";
  const demo = params.get("demo") === "1" || !username;
  const clean = params.get("clean") === "1";
  const title = params.get("title") || DEFAULT_TITLE;
  const welcome = params.get("welcome") ?? DEFAULT_WELCOME;
  const npc = Number(params.get("npc") ?? 16);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [gifts, setGifts] = useState<Toast[]>([]);
  const [showRank, setShowRank] = useState(false);
  const musicRef = useRef<Music | null>(null);
  const musicWanted = useRef(params.get("music") !== "0");
  const [musicOn, setMusicOn] = useState(false);

  // เพลงประกอบ: ลองเล่นทันที (LIVE Studio/OBS อนุญาต) ถ้าเบราว์เซอร์บล็อก จะเริ่มเมื่อแตะหน้าจอครั้งแรก
  useEffect(() => {
    const music = new Music();
    musicRef.current = music;
    const tryStart = () => {
      if (!musicWanted.current) return;
      music.start().then((ok) => {
        setMusicOn(ok);
        if (ok) window.removeEventListener("pointerdown", tryStart);
      });
    };
    tryStart();
    window.addEventListener("pointerdown", tryStart);
    return () => {
      window.removeEventListener("pointerdown", tryStart);
      music.dispose();
      musicRef.current = null;
    };
  }, []);

  // เสียงพูดแนะนำวิธีเล่น + ขอบคุณของขวัญ (?voice=0 ปิด · ?guide=วินาที ตั้งความถี่)
  const voiceRef = useRef<Voice | null>(null);
  const voiceWanted = useRef(params.get("voice") !== "0");
  const guideEvery = Number(params.get("guide") ?? 75);
  const [voiceOn, setVoiceOn] = useState(false);

  useEffect(() => {
    const voice = new Voice({ onSpeaking: (s) => musicRef.current?.duck(s) });
    voiceRef.current = voice;
    if (!voice.supported) return;
    const tryEnable = () => {
      if (!voiceWanted.current || voice.enabled) return;
      voice.enable(guideEvery);
      setVoiceOn(true);
      window.removeEventListener("pointerdown", tryEnable);
    };
    // เบราว์เซอร์ยอมให้พูดได้หลังผู้ใช้เคยแตะหน้าเว็บแล้วเท่านั้น
    const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive;
    if (activated) tryEnable();
    window.addEventListener("pointerdown", tryEnable);
    return () => {
      window.removeEventListener("pointerdown", tryEnable);
      voice.dispose();
      voiceRef.current = null;
    };
  }, [guideEvery]);

  const toggleVoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    const voice = voiceRef.current;
    if (!voice?.supported) return;
    if (voiceOn) {
      voiceWanted.current = false;
      voice.disable();
      setVoiceOn(false);
    } else {
      voiceWanted.current = true;
      voice.enable(guideEvery);
      setVoiceOn(true);
    }
  };

  const toggleMusic = (e: React.MouseEvent) => {
    e.stopPropagation();
    const music = musicRef.current;
    if (!music) return;
    if (musicOn) {
      musicWanted.current = false;
      music.stop();
      setMusicOn(false);
    } else {
      musicWanted.current = true;
      music.start().then(setMusicOn);
    }
    // การกดปุ่มนี้นับเป็นการแตะครั้งแรกด้วย จึงเปิดเสียงพูดไปพร้อมกัน
    const voice = voiceRef.current;
    if (voiceWanted.current && voice?.supported && !voice.enabled) {
      voice.enable(guideEvery);
      setVoiceOn(true);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    let game: Game | null = null;
    let stopSource = () => {};
    let ro: ResizeObserver | null = null;
    let cancelled = false;
    let toastId = 0;

    const onFeed = (f: FeedItem) => {
      const id = ++toastId;
      const item = { ...f, id };
      if (f.kind === "gift") {
        musicRef.current?.chime();
        if (f.name && f.gift) voiceRef.current?.thankGift(f.name, f.gift, f.count ?? 1);
        setGifts((g) => [...g.slice(-2), item]);
        setTimeout(() => setGifts((g) => g.filter((x) => x.id !== id)), 4500);
      } else {
        if (f.kind === "follow" && f.name) voiceRef.current?.thankFollow(f.name);
        setToasts((ts) => [...ts.slice(-3), item]);
        setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4000);
      }
    };

    const fontFamily = kanit.style.fontFamily;
    document.fonts
      .load(`bold 12px ${fontFamily}`, "กขค abc")
      .catch(() => {})
      .then(() => {
        if (cancelled) return;
        game = new Game(canvas, { fontFamily, npcCount: npc, onHud: setHud, onFeed });
        const g = game;
        const fit = () => g.resize(wrap.clientWidth, wrap.clientHeight);
        fit();
        ro = new ResizeObserver(fit);
        ro.observe(wrap);
        g.start();

        const handle = (e: LiveEvent) => g.handle(e);
        if (demo) {
          stopSource = startDemo(handle);
        } else {
          const q = new URLSearchParams({ u: username });
          if (roomId) q.set("room", roomId);
          const es = new EventSource(`/api/live?${q}`);
          es.onmessage = (m) => {
            try {
              handle(JSON.parse(m.data));
            } catch {}
          };
          es.onerror = () => handle({ type: "status", state: "error", message: "ขาดการเชื่อมต่อกับเซิร์ฟเวอร์ กำลังลองใหม่..." });
          stopSource = () => es.close();
        }
      });

    return () => {
      cancelled = true;
      stopSource();
      ro?.disconnect();
      game?.stop();
    };
  }, [demo, username, roomId, npc]);

  const status = hud?.status;
  const statusColor =
    status?.state === "connected" ? "bg-emerald-400" : status?.state === "error" ? "bg-red-500" : "bg-amber-400";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div
        ref={wrapRef}
        className="relative h-full max-w-full overflow-hidden select-none"
        style={{ aspectRatio: "9 / 16", containerType: "size" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        {/* แถบหัวข้อวิ่ง */}
        <div className="absolute left-[2%] right-[2%] top-[1%] overflow-hidden rounded-[1.5cqw] border-[0.4cqw] border-amber-300/80 bg-black/55 py-[0.6cqw] text-[3.6cqw] font-semibold text-amber-200">
          <span className="marquee">{title}</span>
        </div>

        {/* แท็บ */}
        <div className="absolute left-[2%] right-[2%] top-[6%] flex gap-[1.5cqw] text-[2.8cqw]">
          <button
            onClick={() => setShowRank((s) => !s)}
            className="rounded-full bg-black/55 px-[2.5cqw] py-[0.6cqw] text-white"
          >
            🎮 การจัดอันดับ
          </button>
          <div className="rounded-full bg-indigo-900/60 px-[2.5cqw] py-[0.6cqw] text-white/90">
            👥 {hud?.players ?? 0} คนในงาน
          </div>
          <div className="ml-auto rounded-full bg-black/55 px-[2.5cqw] py-[0.6cqw] text-pink-200">
            ❤ {(hud?.totalLikes ?? 0).toLocaleString()}
          </div>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggleMusic}
            aria-label={musicOn ? "ปิดเพลง" : "เปิดเพลง"}
            className={`rounded-full px-[2cqw] py-[0.6cqw] ${musicOn ? "bg-black/55 text-white" : "animate-pulse bg-amber-400 text-black"}`}
          >
            {musicOn ? "🔊" : "🔇"}
          </button>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={toggleVoice}
            aria-label={voiceOn ? "ปิดเสียงพูด" : "เปิดเสียงพูด"}
            className={`rounded-full px-[2cqw] py-[0.6cqw] ${voiceOn ? "bg-black/55 text-white" : "bg-black/30 text-white/50 line-through"}`}
          >
            🗣️
          </button>
        </div>

        {/* VIP */}
        {hud?.vip && (
          <div className="pop-in absolute left-[5%] top-[18.5%] flex w-[36%] items-center gap-[1.5cqw] rounded-[1.5cqw] border-[0.5cqw] border-amber-300 bg-indigo-950/85 p-[1.2cqw] shadow-[0_0_3cqw_rgba(255,215,106,0.5)]">
            <Avatar src={hud.vip.avatar} name={hud.vip.name} className="h-[9cqw] w-[9cqw] border-amber-300" />
            <div className="min-w-0 flex-1">
              <div className="font-pixel text-[2.8cqw] text-amber-300">★ VIP ★</div>
              <div className="truncate font-pixel text-[3.2cqw] text-white">{hud.vip.name}</div>
              <div className="mt-[0.5cqw] h-[1cqw] rounded-full bg-black/50">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-400"
                  style={{ width: `${Math.min(100, (hud.vip.coins % 100) || 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* LAST DONATE */}
        {hud?.lastDonate && (
          <div
            key={hud.lastDonate.name + hud.lastDonate.giftName + hud.lastDonate.count}
            className="pop-in absolute right-[1%] top-[26%] flex w-[32%] items-center gap-[1.5cqw] rounded-[1.5cqw] border-[0.5cqw] border-violet-400 bg-indigo-950/85 p-[1.2cqw]"
          >
            <Avatar src={hud.lastDonate.avatar} name={hud.lastDonate.name} className="h-[9cqw] w-[9cqw] border-violet-300" />
            <div className="min-w-0 flex-1 text-center">
              <div className="font-pixel text-[2.4cqw] tracking-wide text-cyan-200">LAST DONATE</div>
              <div className="truncate font-pixel text-[3.2cqw] text-amber-200">{hud.lastDonate.name}</div>
            </div>
          </div>
        )}

        {/* ตารางอันดับ */}
        {showRank && (
          <div className="pop-in absolute left-[4%] right-[4%] top-[10%] max-h-[60%] overflow-auto rounded-[2cqw] border-[0.5cqw] border-amber-300 bg-indigo-950/95 p-[3cqw]">
            <div className="mb-[2cqw] flex items-center justify-between">
              <div className="text-[4.2cqw] font-bold text-amber-300">🏆 ลีกมั่งคั่งรุ่นจิ๋ว</div>
              <button onClick={() => setShowRank(false)} className="text-[4cqw] text-white/70">
                ✕
              </button>
            </div>
            {(hud?.leaderboard.length ?? 0) === 0 && (
              <div className="py-[4cqw] text-center text-[3.4cqw] text-white/60">ยังไม่มีใครส่งของขวัญ 🎁</div>
            )}
            {hud?.leaderboard.map((r, i) => (
              <div key={r.id} className="flex items-center gap-[2cqw] border-b border-white/10 py-[1.4cqw] text-[3.4cqw]">
                <div className="w-[6cqw] text-center font-bold text-amber-300">{i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</div>
                <Avatar src={r.avatar} name={r.name} className="h-[7cqw] w-[7cqw] border-white/50" />
                <div className="flex-1 truncate">{r.name}</div>
                <div className="font-semibold text-amber-200">🪙 {r.coins.toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}

        {/* แบนเนอร์ของขวัญ */}
        <div className="absolute left-[3%] top-[44%] flex flex-col gap-[1cqw]">
          {gifts.map((g) => (
            <div
              key={g.id}
              className="toast-in flex items-center gap-[1.5cqw] rounded-full bg-gradient-to-r from-fuchsia-600/90 to-amber-500/80 py-[0.8cqw] pl-[0.8cqw] pr-[3cqw] text-[3.2cqw] font-semibold text-white shadow-lg"
            >
              <Avatar src={g.avatar} name={g.text} className="h-[7cqw] w-[7cqw] border-white" />
              <span className="max-w-[55cqw] truncate">{g.text}</span>
              {g.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image} alt="" referrerPolicy="no-referrer" className="h-[7cqw] w-[7cqw]" />
              )}
            </div>
          ))}
        </div>

        {/* คนเข้าร่วม */}
        <div className="absolute bottom-[13%] left-[3%] flex flex-col gap-[1cqw]">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="toast-in flex items-center gap-[1.5cqw] rounded-full bg-black/50 py-[0.5cqw] pl-[0.5cqw] pr-[3cqw] text-[3.2cqw] text-white"
            >
              <Avatar src={t.avatar} name={t.text} className="h-[6cqw] w-[6cqw] border-white/60" />
              <span className="max-w-[60cqw] truncate">{t.text}</span>
            </div>
          ))}
        </div>

        {/* ข้อความต้อนรับ */}
        {welcome && (
          <div className="absolute bottom-[4.5%] left-[3%] right-[3%] rounded-[2cqw] bg-black/45 px-[2.5cqw] py-[1.2cqw] text-[3.3cqw] leading-snug text-white">
            {welcome}
          </div>
        )}

        {/* สถานะการเชื่อมต่อ */}
        {!clean && status?.message && (
          <div className="absolute bottom-[1%] right-[1%] flex items-center gap-[1cqw] rounded-full bg-black/60 px-[2cqw] py-[0.5cqw] text-[2.4cqw] text-white/80">
            <span className={`inline-block h-[1.6cqw] w-[1.6cqw] rounded-full ${statusColor}`} />
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full border-[0.4cqw] bg-fuchsia-600 font-bold text-white ${className}`}
      >
        {Array.from(name)[0]?.toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-full border-[0.4cqw] object-cover ${className}`}
    />
  );
}
