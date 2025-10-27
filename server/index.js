import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import cassandra from "cassandra-driver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());               // allow your Vite dev origin
app.use(express.json());

// ---- Cassandra client ----
const contactPoints = ["192.168.88.223"];     // internal IP from your doc
const localDataCenter = "datacenter1";        // from your doc’s JDBC hint
const keyspace = "subjectplanning";
const username = "planusertest";
const password = "Ic7cU8K965Zqx";

const authProvider = new cassandra.auth.PlainTextAuthProvider(username, password);
const client = new cassandra.Client({
    contactPoints,
    localDataCenter,
    keyspace,
    authProvider,
    protocolOptions: { port: 9042 }
});

async function ensureDb() {
    try {
        await client.connect();
        console.log("✅ Connected to Cassandra");
    } catch (e) {
        console.error("❌ Cassandra connect failed:", e.message);
        process.exit(1);
    }
}

// ---- API: electives for a student + bucket ----
// Shape returned to frontend: { options: [{subjectId, title, credits}, ...] }
app.get("/api/electives", async (req, res) => {
    const { studentId, bucketId } = req.query;
    if (!bucketId) return res.status(400).json({ error: "bucketId required" });

    try {
        // NOTE: Adjust table/column names to your schema.
        // Example schema guess:
        //   elective_bucket_options(bucket_id TEXT, subject_id TEXT, title TEXT, credits INT, PRIMARY KEY(bucket_id, subject_id))
        //
        // If options depend on program or student, join/union with your student/program tables.
        // For demo, we filter by bucket only:
        const query = `
      SELECT subject_id, title, credits
      FROM elective_bucket_options
      WHERE bucket_id = ?
      ALLOW FILTERING
    `;
        const result = await client.execute(query, [bucketId], { prepare: true });

        const options = result.rows.map(r => ({
            subjectId: r["subject_id"],
            title: r["title"],
            credits: Number(r["credits"] ?? 3)
        }));

        return res.json({ options });
    } catch (e) {
        console.error("GET /api/electives error:", e.message);
        return res.status(500).json({ error: "Failed to fetch elective options" });
    }
});

// ---- API: plan passthrough (optional) ----
// serves your existing /public/plan.json so frontend can later switch to /api/plan
app.get("/api/plan", async (_req, res) => {
    try {
        const planPath = path.resolve(__dirname, "../public/plan.json"); // adjust if server is outside the Vite project
        const content = await fs.readFile(planPath, "utf-8");
        res.type("application/json").send(content);
    } catch (e) {
        res.status(500).json({ error: "plan.json not found" });
    }
});

const PORT = process.env.PORT || 3000;

ensureDb().then(() => {
    app.listen(PORT, () => {
        console.log(`API listening on http://localhost:${PORT}`);
    });
});
