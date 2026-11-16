import type { NextRequest } from "next/server";
import { subscribe } from "@/lib/live/manager";

// Server-Sent Events: GET /api/live?u=<tiktok username>
export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("u")?.trim();
  if (!username) {
    return new Response("missing ?u=username", { status: 400 });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const roomId = request.nextUrl.searchParams.get("room") ?? undefined;
      const unsubscribe = subscribe(username, send, roomId);
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 15000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        cleanup = () => {};
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
