import crypto from "node:crypto";

export function stableFingerprint(value: unknown): string {
  const sorted = sortStable(value);
  const payload = JSON.stringify(sorted);
  return crypto.createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

function sortStable(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortStable(entry));
  }

  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    const out: Record<string, unknown> = {};

    for (const key of keys) {
      out[key] = sortStable(object[key]);
    }

    return out;
  }

  return value;
}
