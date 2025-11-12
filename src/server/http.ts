import express from "express";
import cors from "cors";
import { loadAllPlans } from "../dsl/registry";
import { getStudentById } from "../services/studentService";
import { getSubjectAttemptsByStudentId } from "../services/subjectService";
import { computeAndPersistSchedule } from "../services/scheduleService";
import { connectCassandra, isCassandraAvailable, cassandraClient } from "../services/cassandraClient";

const app = express();
app.use(cors());
app.use(express.json());

// Load plans once on boot
loadAllPlans();

// Root route
app.get("/", (_req, res) => {
    res.type("text/plain").send([
        "✅ Subject Planner API is running",
        "",
        "Available routes:",
        "  GET /api/health              - Quick health check",
        "  GET /api/student/:id         - Get student profile",
        "  GET /api/attempts/:id        - Get subject attempts",
        "  GET /api/schedule/:id        - Get computed schedule"
    ].join("\n"));
});

// Simple health
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Student profile
app.get("/api/student/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
        const data = await getStudentById(id);
        if (!data) return res.status(404).json({ error: "Not found" });
        res.json(data);
    } catch (e:any) {
        res.status(500).json({ error: e.message || String(e) });
    }
});

// Raw attempts
app.get("/api/attempts/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
        const data = await getSubjectAttemptsByStudentId(id);
        res.json(data);
    } catch (e:any) {
        res.status(500).json({ error: e.message || String(e) });
    }
});

// Computed schedule (and persisted to cache)
app.get("/api/schedule/:id", async (req, res) => {
    const id = Number(req.params.id);
    try {
        const data = await computeAndPersistSchedule(id);
        res.json(data);
    } catch (e:any) {
        res.status(500).json({ error: e.message || String(e) });
    }
});

// Boot function so we can await Cassandra then listen
async function start() {
    await connectCassandra();
    if (!isCassandraAvailable()) {
        console.error("[server] Cassandra not available. Exiting.");
        process.exit(1);
    }
    const port = Number(process.env.PORT || 3001);
    app.listen(port, () =>
        console.log(`[server] listening on http://localhost:${port}`)
    );

    // graceful shutdown
    process.on("SIGINT", async () => {
        await cassandraClient.shutdown();
        process.exit(0);
    });
}

start().catch(e => {
    console.error(e);
    process.exit(1);
});
