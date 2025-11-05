// src/index.ts
import { connectCassandra, isCassandraAvailable, cassandraClient } from "./services/cassandraClient";
import { getStudentById } from "./services/studentService";
import { getStudentSemesterProgress } from "./services/progressService";
import { buildRetakePlanForStudent } from "./utils/retakePlanner";
import { loadAllPlans, listPlans } from "./dsl/registry";

// load plans once at start
loadAllPlans();
console.log("[plans] available:", listPlans());

async function main() {
    await connectCassandra();

    if (!isCassandraAvailable()) {
        console.log("Cassandra not available. Exiting.");
        return;
    }

    const testId = 4773194;

    const student = await getStudentById(testId);
    console.log("Student:", student);

    const semesters = await getStudentSemesterProgress(testId);
    console.log("Semester view:");
    console.dir(semesters, { depth: 10 });

    // cohortYear we already computed in studentService (2018 for your student)
    const cohortYear = student?.cohortYear || 0;

    const retakes = await buildRetakePlanForStudent(testId, cohortYear);
    console.log("Retake plan:");
    console.dir(retakes, { depth: 10 });

    await cassandraClient.shutdown();
    console.log("Done.");
}

main().catch(async (err) => {
    console.error(err);
    try { await cassandraClient.shutdown(); } catch {}
});
