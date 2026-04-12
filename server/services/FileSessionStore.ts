import session from "express-session";
import fs from "fs";
import path from "path";
import { HUB_SESSIONS_DIR } from "../utils/repoPaths";

const SESSIONS_DIR = HUB_SESSIONS_DIR;

export class FileSessionStore extends session.Store {
  constructor() {
    super();
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }

  private filePath(sid: string): string {
    const safe = sid.replace(/[^a-zA-Z0-9_-]/g, "_");
    return path.join(SESSIONS_DIR, `${safe}.json`);
  }

  get(sid: string, callback: (err: any, session?: session.SessionData | null) => void): void {
    try {
      const raw = fs.readFileSync(this.filePath(sid), "utf-8");
      const data = JSON.parse(raw);
      if (data.expires && Date.now() > data.expires) {
        this.destroy(sid, () => {});
        callback(null, null);
        return;
      }
      callback(null, data.session);
    } catch {
      callback(null, null);
    }
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void): void {
    try {
      const cookieExpires = (sessionData.cookie?.expires as Date | undefined)?.getTime();
      const expires = cookieExpires || Date.now() + 86400000;
      fs.writeFileSync(this.filePath(sid), JSON.stringify({ session: sessionData, expires }));
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: any) => void): void {
    try {
      fs.unlinkSync(this.filePath(sid));
    } catch {}
    callback?.();
  }

  touch(sid: string, sessionData: session.SessionData, callback?: () => void): void {
    this.set(sid, sessionData, callback);
  }

  all(callback: (err: any, sessions?: session.SessionData[] | { [sid: string]: session.SessionData } | null) => void): void {
    try {
      const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
      const result: { [sid: string]: session.SessionData } = {};
      for (const f of files) {
        try {
          const raw = fs.readFileSync(path.join(SESSIONS_DIR, f), "utf-8");
          const data = JSON.parse(raw);
          if (!data.expires || Date.now() <= data.expires) {
            const sid = f.replace(/\.json$/, "");
            result[sid] = data.session;
          }
        } catch {}
      }
      callback(null, result);
    } catch (err) {
      callback(err);
    }
  }

  clear(callback?: (err?: any) => void): void {
    try {
      const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
      for (const f of files) {
        try { fs.unlinkSync(path.join(SESSIONS_DIR, f)); } catch {}
      }
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  length(callback: (err: any, length?: number) => void): void {
    try {
      const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
      callback(null, files.length);
    } catch (err) {
      callback(err);
    }
  }
}
