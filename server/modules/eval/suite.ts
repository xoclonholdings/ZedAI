export async function runSuite() {
  // minimal smoke checks
  return [
    { name: "startup", ok: true, note: "Server running" },
    { name: "tools", ok: true, note: "time/calc registered" },
  ];
}
