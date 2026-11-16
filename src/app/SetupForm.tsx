"use client";

import { useState } from "react";

export default function SetupForm() {
  const [user, setUser] = useState("");
  const [room, setRoom] = useState("");
  const [title, setTitle] = useState("");
  const [welcome, setWelcome] = useState("");
  const [clean, setClean] = useState(false);
  const [copied, setCopied] = useState(false);

  const q = new URLSearchParams();
  const u = user.replace(/^@/, "").trim();
  if (u) q.set("u", u);
  else q.set("demo", "1");
  const roomId = room.match(/\d{6,}/)?.[0];
  if (u && roomId) q.set("room", roomId);
  if (title.trim()) q.set("title", title.trim());
  if (welcome.trim()) q.set("welcome", welcome.trim());
  if (clean) q.set("clean", "1");
  const path = `/live?${q.toString()}`;

  const copy = async () => {
    await navigator.clipboard.writeText(location.origin + path);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white/5 p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-white/70">ชื่อผู้ใช้ TikTok (ต้องกำลัง LIVE อยู่) — เว้นว่าง = โหมดทดลอง</span>
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="@username"
          className="rounded-lg bg-black/40 px-3 py-2 outline-none ring-amber-300 focus:ring-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-white/70">
          Room ID (ไม่บังคับ — ใส่เมื่อเชื่อมต่อไม่ได้) · เปิดหน้าไลฟ์ของตัวเองบนเว็บ แล้วกด <b>Ctrl+U</b> ค้นหา{" "}
          <code>roomId</code>
        </span>
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="เช่น 7571234567890123456"
          inputMode="numeric"
          className="rounded-lg bg-black/40 px-3 py-2 outline-none ring-amber-300 focus:ring-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-white/70">ข้อความหัวข้อวิ่ง (ไม่บังคับ)</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="พาตัวละครไปเล่นเครื่องเล่นได้เลยจ้า"
          className="rounded-lg bg-black/40 px-3 py-2 outline-none ring-amber-300 focus:ring-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm text-white/70">ข้อความต้อนรับด้านล่าง (ไม่บังคับ)</span>
        <input
          value={welcome}
          onChange={(e) => setWelcome(e.target.value)}
          placeholder="ยินดีต้อนรับสู่งานวัด Pixel Live!"
          className="rounded-lg bg-black/40 px-3 py-2 outline-none ring-amber-300 focus:ring-2"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-white/80">
        <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} />
        ซ่อนแถบสถานะการเชื่อมต่อ (สำหรับออกอากาศจริง)
      </label>
      <div className="flex gap-2">
        <a href={path} target="_blank" className="flex-1 rounded-lg bg-amber-400 px-4 py-2 text-center font-semibold text-black">
          {u ? "เปิดเกม" : "เปิดโหมดทดลอง"}
        </a>
        <button onClick={copy} className="rounded-lg bg-white/10 px-4 py-2">
          {copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}
        </button>
      </div>
      <code className="break-all text-xs text-white/50">{path}</code>
    </section>
  );
}
