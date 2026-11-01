// Uploaded files, outside the JSON database (known-issues 4, 9 and 19): each is kept in the gitignored
// uploads/ folder under a random name, and the record holds only that reference. A file is reached only
// through the route that checks who is asking (GET /api/liquidation-submissions/:id/documents/:docId);
// the folder itself is never served. Names end in .bin so nothing in it can run by being opened.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { StoredFile } from "../types";
import { SAFE_FILE_URL } from "../utils";

const STORED_NAME = /^[0-9a-f-]{36}\.bin$/;
const uploadsDir = () => path.join(process.cwd(), "uploads");

/** Saves a base64 data URL as a file. Null when it isn't one, or it holds nothing. */
export function storeDataUrl(content: unknown): StoredFile | null {
  if (typeof content !== "string" || !SAFE_FILE_URL.test(content)) return null;
  const comma = content.indexOf(",");
  const bytes = Buffer.from(content.slice(comma + 1), "base64");
  if (bytes.length === 0) return null;
  const type = content.slice("data:".length, comma).split(";")[0];
  // Only the server's own account may read them, where the system honours that (not on Windows).
  fs.mkdirSync(uploadsDir(), { recursive: true, mode: 0o700 });
  const file = `${crypto.randomUUID()}.bin`;
  fs.writeFileSync(path.join(uploadsDir(), file), bytes, { flag: "wx", mode: 0o600 });
  return { file, type, bytes: bytes.length };
}

/** A stored file as a base64 data URL, or null when it can't be read. Only a name this store made is
 * opened, so a damaged record can't reach anything outside the folder. */
export function readStoredFile(stored: StoredFile | null | undefined): string | null {
  if (!stored || typeof stored.file !== "string" || !STORED_NAME.test(stored.file)) return null;
  try {
    return `data:${stored.type || ""};base64,${fs.readFileSync(path.join(uploadsDir(), stored.file)).toString("base64")}`;
  } catch {
    return null;
  }
}
