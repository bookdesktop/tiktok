export type LiveUser = {
  id: string;
  name: string;
  avatar?: string;
};

export type LiveEvent =
  | { type: "status"; state: "connecting" | "connected" | "disconnected" | "error"; message?: string }
  | { type: "join"; user: LiveUser }
  | { type: "chat"; user: LiveUser; text: string }
  | { type: "gift"; user: LiveUser; giftName: string; count: number; coins: number; image?: string }
  | { type: "like"; user: LiveUser; count: number; total?: number }
  | { type: "follow"; user: LiveUser }
  | { type: "share"; user: LiveUser }
  | { type: "viewers"; count: number };
