import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, ".cache");

function ensureDir() {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export function cacheWrite(name: string, data: unknown) {
    ensureDir();
    const file = path.join(CACHE_DIR, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
    return file;
}

export function cacheRead<T = unknown>(name: string): T | null {
    ensureDir();
    const file = path.join(CACHE_DIR, `${name}.json`);
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, "utf8")) as T;
    } catch {
        return null;
    }
}
