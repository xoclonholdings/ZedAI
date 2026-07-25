import type { Server as HttpServer } from "http";
import { randomBytes } from "crypto";
import { WebSocketServer, type WebSocket } from "ws";

import {
  dispatchLiveInput,
  getPendingScreenSize,
  hasPendingSignIn,
  startLiveScreencast,
  stopLiveScreencast,
  type LiveInputEvent,
} from "./BrowserSignInService";

/**
 * The browser-side half of the human hand-off: an admin-authenticated
 * REST call mints a short-lived, single-use ticket bound to one
 * pendingId, then the client opens a WebSocket carrying that ticket.
 * The socket streams live screenshots of the stuck page and relays
 * the human's clicks/typing back into it via CDP.
 *
 * A raw WS upgrade can't ride along express-session's cookie/auth
 * middleware, so the ticket stands in for that: it only exists
 * because an already-isAdmin-gated request minted it, it's single-
 * use, and it expires in two minutes if unused.
 */

const WS_PATH = "/ws/admin/signin-handoff";
const TICKET_TTL_MS = 2 * 60 * 1000;

interface Ticket {
  pendingId: string;
  expiresAt: number;
  used: boolean;
}

const tickets = new Map<string, Ticket>();

function sweepStaleTickets() {
  const now = Date.now();
  for (const [ticket, entry] of tickets) {
    if (now > entry.expiresAt) tickets.delete(ticket);
  }
}
setInterval(sweepStaleTickets, 60_000).unref?.();

export function mintHandoffTicket(pendingId: string): { ticket: string; expiresAt: number } | null {
  if (!hasPendingSignIn(pendingId)) return null;
  const ticket = randomBytes(24).toString("hex");
  const expiresAt = Date.now() + TICKET_TTL_MS;
  tickets.set(ticket, { pendingId, expiresAt, used: false });
  return { ticket, expiresAt };
}

function redeemTicket(ticket: string): string | null {
  const entry = tickets.get(ticket);
  if (!entry || entry.used || Date.now() > entry.expiresAt) return null;
  entry.used = true;
  tickets.delete(ticket);
  return entry.pendingId;
}

export function registerLiveHandoffSocket(httpServer: HttpServer): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url || "", "http://localhost");
    if (url.pathname !== WS_PATH) return;

    const ticket = url.searchParams.get("ticket") || "";
    const pendingId = redeemTicket(ticket);
    if (!pendingId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      void handleConnection(ws, pendingId);
    });
  });
}

async function handleConnection(ws: WebSocket, pendingId: string) {
  const screenSize = getPendingScreenSize(pendingId);
  ws.send(JSON.stringify({ type: "ready", screenSize }));

  const started = await startLiveScreencast(pendingId, (jpegBase64) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "frame", data: jpegBase64 }));
    }
  });

  if (!started) {
    ws.send(JSON.stringify({ type: "error", message: "This sign-in attempt is no longer active." }));
    ws.close();
    return;
  }

  ws.on("message", (raw) => {
    let event: LiveInputEvent | null = null;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (event) void dispatchLiveInput(pendingId, event);
  });

  ws.on("close", () => {
    void stopLiveScreencast(pendingId);
  });
}
