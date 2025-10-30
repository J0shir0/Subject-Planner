// Central app config. Source of truth for runtime flags.
// Mode controls scheduling complexity: "simple" (no extras/retakes) vs "flex" (full rules).

export type PlannerMode = "simple" | "flex";

function readMode(): PlannerMode {
    const raw = (process.env.PLANNER_MODE || "flex").toLowerCase();
    return raw === "simple" ? "simple" : "flex";
}

// Two–digit years (e.g., "23") are in the 2000s.
// Accepts number or string; trims and coerces safely.
export function year2full(yy: number | string): number {
    const s = String(yy).trim();
    const n = Number(s);
    if (!Number.isFinite(n)) throw new Error(`Invalid short year: ${yy}`);
    if (n < 0 || n > 99) throw new Error(`Short year out of range (00–99): ${yy}`);
    return 2000 + n;
}

export const appConfig = {
    mode: readMode(),

    // Cassandra connection (placeholders; wire up in Phase 2)
    cassandra: {
        contactPoints: (process.env.CASSANDRA_CONTACT_POINTS || "127.0.0.1").split(","),
        keyspace: process.env.CASSANDRA_KEYSPACE || "subjectplanningprod",
        datacenter: process.env.CASSANDRA_DATACENTER || "datacenter1",
        username: process.env.CASSANDRA_USERNAME || "",
        password: process.env.CASSANDRA_PASSWORD || "",
        // sensible defaults; tune later
        pooling: { coreConnectionsPerHost: { local: 2, remote: 1 } },
        readTimeout: Number(process.env.CASSANDRA_READ_TIMEOUT_MS || 10000),
    },

    // Local cache DB (will be decided in Phase 1/2; keeping placeholders)
    localDb: {
        url: process.env.LOCALDB_URL || "",
    },
} as const;

// Convenience booleans for quick guards
export const IS_SIMPLE = appConfig.mode === "simple";
export const IS_FLEX = appConfig.mode === "flex";
