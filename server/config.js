const fs = require("fs");
const path = require("path");

function stripQuotes(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = stripQuotes(trimmed.slice(separatorIndex + 1));
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

const accessKey = process.env.STEALTHMOLE_ACCESS_KEY || "";
const secretKey = process.env.STEALTHMOLE_SECRET_KEY || "";
const mockFlag = String(process.env.STEALTHMOLE_MOCK || "").toLowerCase();

module.exports = {
  port: Number(process.env.PORT || 3000),
  stealthmole: {
    baseUrl: process.env.STEALTHMOLE_BASE_URL || "https://hackathon.stealthmole.com",
    accessKey,
    secretKey,
    mockMode: mockFlag === "true" || !accessKey || !secretKey
  },
  limits: {
    jsonBytes: 12 * 1024 * 1024,
    filePreviewBytes: 2 * 1024 * 1024
  }
};
