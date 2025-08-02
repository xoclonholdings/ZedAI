"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL, ensure the database is provisioned");
}
exports.default = {
    out: "./migrations",
    schema: "./shared/schema.ts",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
};
