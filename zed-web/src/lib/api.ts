import ky from "ky";
export const api = ky.create({ prefixUrl: import.meta.env.VITE_API_BASE || "http://localhost:7001" });
// removed
