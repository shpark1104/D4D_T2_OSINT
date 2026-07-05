const crypto = require("crypto");

// Defanging tokens seen in CTI writeups: hxxp://, [.], (.), [at], [@], [:]
const DEFANG_TOKENS = [
  { pattern: "hxxps://", replacement: "https://" },
  { pattern: "hxxp://", replacement: "http://" },
  { pattern: "[.]", replacement: "." },
  { pattern: "(.)", replacement: "." },
  { pattern: "[dot]", replacement: "." },
  { pattern: "[at]", replacement: "@" },
  { pattern: "(at)", replacement: "@" },
  { pattern: "[@]", replacement: "@" },
  { pattern: "[:]", replacement: ":" }
].sort((a, b) => b.pattern.length - a.pattern.length);

// Rebuilds text with defang tokens resolved, keeping an index map back to the
// original string so offsets/context can still point at the source file.
function defang(text) {
  const original = String(text || "");
  const lowerOriginal = original.toLowerCase();
  let normalized = "";
  const map = [];
  let i = 0;

  outer: while (i < original.length) {
    for (const token of DEFANG_TOKENS) {
      const lowerToken = token.pattern.toLowerCase();
      if (lowerOriginal.startsWith(lowerToken, i)) {
        for (const char of token.replacement) {
          normalized += char;
          map.push(i);
        }
        i += token.pattern.length;
        continue outer;
      }
    }
    normalized += original[i];
    map.push(i);
    i += 1;
  }

  return { normalized, map, original };
}

const TYPE_PATTERNS = [
  { type: "url", regex: /\bhttps?:\/\/[^\s"'<>\]\)]+/gi },
  { type: "email", regex: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g },
  {
    type: "ipv4",
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g
  },
  { type: "btc_address", regex: /\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,59})\b/g },
  { type: "eth_address", regex: /\b0x[a-fA-F0-9]{40}\b/g },
  { type: "sha256", regex: /\b[a-fA-F0-9]{64}\b/g },
  { type: "sha1", regex: /\b[a-fA-F0-9]{40}\b/g },
  { type: "md5", regex: /\b[a-fA-F0-9]{32}\b/g },
  { type: "cve", regex: /\bCVE-\d{4}-\d{4,7}\b/gi },
  { type: "mitre_attack_id", regex: /\bT\d{4}(?:\.\d{3})?\b/g },
  { type: "telegram", regex: /(?:^|[\s(])@([a-zA-Z][a-zA-Z0-9_]{4,31})\b/g },
  { type: "discord_id", regex: /\b\d{17,19}\b/g },
  {
    type: "domain",
    regex: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}\b/gi
  }
];

const TRAILING_PUNCTUATION = /[),.;:\]}'"]+$/;

// Common file extensions that the domain regex would otherwise mistake for a
// TLD (e.g. "human2.aspx", "moveitisapi.dll" from a real incident report).
const NON_TLD_EXTENSIONS = new Set([
  "dll", "exe", "sys", "bin", "dat", "bak", "tmp", "old", "log", "lock",
  "aspx", "asp", "php", "jsp", "js", "ts", "jsx", "tsx", "py", "rb", "go",
  "java", "class", "jar", "war", "c", "cpp", "h", "cs", "sh", "bat", "ps1",
  "vbs", "pl", "sql", "csv", "tsv", "txt", "md", "doc", "docx", "xls", "xlsx",
  "ppt", "pptx", "pdf", "zip", "rar", "7z", "tar", "gz", "bz2", "iso", "dmg",
  "msi", "apk", "ini", "cfg", "conf", "yml", "yaml", "json", "xml", "html",
  "htm", "css", "scss", "png", "jpg", "jpeg", "gif", "bmp", "svg", "ico",
  "mp3", "mp4", "wav", "avi", "mov", "mkv", "flv", "env", "git", "config"
]);

function isFileExtensionNotDomain(value) {
  const suffix = value.slice(value.lastIndexOf(".") + 1).toLowerCase();
  return NON_TLD_EXTENSIONS.has(suffix);
}

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

function normalizeValue(type, value) {
  if (type === "domain" || type === "email" || type === "url") {
    return value.toLowerCase();
  }
  return value;
}

function extractIocsFromText(text, sourceFile = "message") {
  const { normalized, map, original } = defang(text);
  const claimed = [];
  const iocs = [];

  for (const { type, regex } of TYPE_PATTERNS) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      let raw = match[0];
      let matchStart = match.index;
      let matchEnd = matchStart + raw.length;

      const trimmed = raw.replace(TRAILING_PUNCTUATION, "");
      if (trimmed.length !== raw.length) {
        matchEnd = matchStart + trimmed.length;
        raw = trimmed;
      }
      if (!raw) continue;
      if (type === "domain" && isFileExtensionNotDomain(raw)) continue;

      const span = { start: matchStart, end: matchEnd };
      if (claimed.some((range) => overlaps(range, span))) continue;

      const originalStart = map[matchStart] ?? 0;
      const originalEnd = matchEnd > 0 ? (map[matchEnd - 1] ?? originalStart) + 1 : originalStart;
      const rawValue = original.slice(originalStart, originalEnd);
      const value = normalizeValue(type, type === "telegram" ? `@${match[1]}` : raw);
      const contextStart = Math.max(0, originalStart - 50);
      const contextEnd = Math.min(original.length, originalEnd + 50);
      const lineNumber = original.slice(0, originalStart).split("\n").length;

      claimed.push(span);
      iocs.push({
        id: crypto.randomUUID(),
        type,
        value,
        raw_value: rawValue,
        source_file: sourceFile,
        line_number: lineNumber,
        offset: { start: originalStart, end: originalEnd },
        context: original.slice(contextStart, contextEnd),
        confidence: 1.0,
        extraction_method: "regex"
      });
    }
  }

  return iocs.sort((a, b) => a.offset.start - b.offset.start);
}

function mergeIocs(...groups) {
  const seen = new Map();
  for (const group of groups) {
    for (const ioc of group || []) {
      const key = `${ioc.type}:${String(ioc.value).toLowerCase()}`;
      const existing = seen.get(key);
      if (!existing || ioc.confidence > existing.confidence) {
        seen.set(key, ioc);
      }
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.type.localeCompare(b.type));
}

module.exports = { extractIocsFromText, mergeIocs, defang };
