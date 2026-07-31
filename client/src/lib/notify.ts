const STORAGE_KEY = "zed_app_settings";

function getSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function isPageVisible(): boolean {
  return document.visibilityState === "visible";
}

function canNotify(key: string): boolean {
  const s = getSettings();
  if (s.notifications === false) return false;
  return s[key] !== false;
}

function fire(title: string, body: string, icon = "/favicon.ico") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon, silent: false });
  } catch {}
}

export function notifyMessage(agentName: string, preview: string) {
  if (isPageVisible()) return;
  if (!canNotify("messageNotifications")) return;
  fire(`ZAR — ${agentName}`, preview.slice(0, 100));
}

export function notifyAgentTask(agentName: string, detail: string) {
  if (!canNotify("agentAlerts")) return;
  fire(`ZAR Agent — ${agentName}`, detail.slice(0, 100));
}

export function notifySystem(title: string, detail: string) {
  if (!canNotify("systemAlerts")) return;
  fire(`ZAR System — ${title}`, detail.slice(0, 100));
}
