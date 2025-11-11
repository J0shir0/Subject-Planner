import { connectCassandra, isCassandraAvailable, cassandraClient } from "./services/cassandraClient";
import { getStudentById } from "./services/studentService";
import { getSubjectAttemptsByStudentId } from "./services/subjectService";
import { loadAllPlans, listPlans, getPlan } from "./dsl/registry";
import { findSubjectInPlan } from "./dsl/lookup";
import { buildSchedule } from "./scheduler/retakeAllocator";
import { withTimeout } from "./utils/withTimeout";

// ---- load plans once at start
console.time("plans:load");
loadAllPlans();
console.timeEnd("plans:load");
for (const p of listPlans()) {
    console.log(` - ${p.programmeCode} (Cohort ${p.cohort})`);
}

function normalizeCohort(raw: string): string {
    const m = String(raw || "").match(/^(\d{4})(?:-?)(\d{2})$/);
    return m ? `${m[1]}-${m[2]}` : "";
}

async function main() {
    console.time("cassandra:connect");
    await connectCassandra();
    console.timeEnd("cassandra:connect");

    if (!isCassandraAvailable()) {
        console.log("Cassandra not available. Exiting.");
        await cassandraClient.shutdown();
        return;
    }

    const studentId = 6076690; // <- test id

    console.time("student:fetch");
    const student = await getStudentById(studentId);
    console.timeEnd("student:fetch");

    console.time("attempts:fetch");
    const attemptsRaw = await withTimeout(
        getSubjectAttemptsByStudentId(studentId),
        15000,
        "getSubjectAttemptsByStudentId"
    );
    console.timeEnd("attempts:fetch");

    const programmeCode = student?.programmeCode ?? attemptsRaw[0]?.programmeCode ?? "";
    const cohort       = normalizeCohort(student?.cohort ?? "");
    const nowYear      = new Date().getFullYear();
    const cohortYear   = Number((student?.cohort || "").toString().slice(0, 4)) || nowYear;

    const plan = programmeCode ? getPlan(programmeCode, cohort) : null;

    // map attempts first (so debug can use them)
    const attempts = attemptsRaw.map(a => {
        let planned: { yearNumber: number; sem: "JAN" | "APR" | "SEP" } | undefined;
        if (plan) {
            const look = findSubjectInPlan(plan, a.subjectCode);
            if (look.found && look.location) {
                planned = { yearNumber: look.location.yearNumber, sem: look.location.sem };
            }
        }
        return {
            subjectCode: a.subjectCode,
            subjectName: a.subjectName,
            grade: a.grade ?? null,
            examYear: a.examYear,
            examMonth: a.examMonth,
            planned,
        };
    });

    if (plan) {
        // ------- quick visibility on what the parser produced vs what's passed
        const planned = new Map<string, string[]>(); // "2024-SEP" -> ["SEG1201", ...]
        for (const y of plan.years) {
            const calYear = cohortYear + (y.yearNumber - 1);
            for (const sem of y.semesters) {
                const key  = `${calYear}-${sem.sem}`;
                const list = sem.subjects.map(s => s.code.toUpperCase());
                planned.set(key, list);
            }
        }
        const passed = new Set(
            attempts
                .filter(a => {
                    const g = (a.grade || "").toUpperCase();
                    return g && g !== "F" && g !== "F*";
                })
                .map(a => a.subjectCode.toUpperCase())
        );

        console.log("\n[plan] semesters:",
            plan.years.map(y => ({ year: y.yearNumber, sems: y.semesters.map(s => s.sem) }))
        );
        console.log("\n[debug] planned vs passed:");
        for (const [k, list] of planned.entries()) {
            const missing = list.filter(code => !passed.has(code));
            console.log(`  ${k}: planned=${list.length}, missing=${missing.length}`, missing);
        }
    }

    console.time("schedule:build");
    const { schedule, overflow } = buildSchedule(plan, attempts, {
        currentCalendarYear: nowYear,
        cohortYear,
        enforceCap: false, // <- per supervisor: ignore caps for now
    });
    console.timeEnd("schedule:build");

    console.log("\n=== Planned Schedule ===");
    for (const it of schedule) {
        console.log(`${it.year}-${it.sem}: ${it.subjectCode} (${it.reason})`);
    }
    if (overflow.length) {
        console.log("\n⚠ Overflow (cap exceeded):");
        for (const it of overflow) console.log(` - ${it.year}-${it.sem}: ${it.subjectCode} (${it.reason})`);
    }

    await cassandraClient.shutdown();
}

// call once (no recursion)
main().catch(e => {
    console.error(e);
    return cassandraClient.shutdown();
});
