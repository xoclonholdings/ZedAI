import { execSync } from "node:child_process";
console.log(">> Generating Prisma client...");
execSync("npx prisma generate", { stdio: "inherit" });
console.log(">> Running Prisma migrate (dev)...");
execSync("npx prisma migrate dev --name init --create-only", { stdio: "inherit" });
console.log(">> Creating data folder if missing...");
execSync("mkdir -p data", { stdio: "inherit" });
console.log("Bootstrap complete.");
