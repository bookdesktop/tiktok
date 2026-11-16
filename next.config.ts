import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  // ให้มือถือในวง LAN เปิดหน้าเกมจาก dev server ได้ (สำหรับแชร์หน้าจอไลฟ์จากมือถือ)
  allowedDevOrigins: ["192.168.*.*"],
  cacheComponents: true,
  serverExternalPackages: ["tiktok-live-connector"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
