// src/index.ts
import { connectCassandra, isCassandraAvailable, cassandraClient } from "./services/cassandraClient";
import { getStudentById } from "./services/studentService";
import { getSubjectAttemptsByStudentId } from "./services/subjectService";

async function main() {
    await connectCassandra();

    if (!isCassandraAvailable()) {
        console.log("Cassandra not available. Exiting.");
        return;
    }

    // 👇 from your Excel
    const testId = 9897587;

    const student = await getStudentById(testId);
    console.log("Student:", student);

    const subjects = await getSubjectAttemptsByStudentId(testId);
    console.log(`Subjects for ${testId}:`, subjects.length);
    console.log(subjects.slice(0, 5)); // show first 5

    // close connection so app doesn't hang
    await cassandraClient.shutdown();
    console.log("Done.");
}

main().catch(async (err) => {
    console.error(err);
    try { await cassandraClient.shutdown(); } catch {}
});
