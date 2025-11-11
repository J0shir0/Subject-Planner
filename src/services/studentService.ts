// src/services/studentService.ts
import { cassandraClient, isCassandraAvailable } from "./cassandraClient";
import { StudentDTO } from "../dto";

export async function getStudentById(id: number | string): Promise<StudentDTO | null> {
    if (!isCassandraAvailable()) {
        console.warn("[StudentService] Cassandra not available → null");
        return null;
    }

    const numericId = typeof id === "string" ? Number(id) : id;

    // matches your Excel structure: subjectplanning.students
    const query = `
    SELECT id, programme, cohort, ic, name, overallcgpa, programmecode, status, gender, graduated, broadsheetyear
    FROM subjectplanning.students
    WHERE id = ? ALLOW FILTERING
  `;

    try {
        const result = await cassandraClient.execute(query, [numericId], { prepare: true });
        if (result.rowLength === 0) {
            console.log(`[StudentService] No student with id=${numericId}`);
            return null;
        }

        const r = result.rows[0];

        // cohort in Excel looks like 201803, 202502 (YYYYMM)
        // we can extract year = first 4 digits
        const cohortStr = r.cohort ? String(r.cohort) : "";
        const cohortYear =
            cohortStr.length >= 4 ? Number(cohortStr.slice(0, 4)) : undefined;

        const dto: StudentDTO = {
            id: r.id, // 9897587
            ic: r.ic, // might be short or null in fake data
            name: r.name,
            programme: r.programme,
            programmeCode: r.programmecode,
            cohort: r.cohort ? String(r.cohort) : "",
            cohortYear: cohortYear || 0,
            gender: r.gender,
            status: r.status,
            graduated: r.graduated,
            overallCGPA: r.overallcgpa,
        };

        return dto;
    } catch (err) {
        console.error("[StudentService] getStudentById failed:", err);
        return null;
    }
}
