// src/services/subjectService.ts
import { cassandraClient, isCassandraAvailable } from "./cassandraClient";
import { SubjectAttemptDTO } from "../dto";
import { year2full } from "../config/app";

export async function getSubjectAttemptsByStudentId(id: number | string): Promise<SubjectAttemptDTO[]> {
    if (!isCassandraAvailable()) {
        console.warn("[SubjectService] Cassandra not available → []");
        return [];
    }

    const numericId = typeof id === "string" ? Number(id) : id;

    const query = `
    SELECT id, programmecode, subjectcode, subjectname, examyear, exammonth,
           status, attendancepercentage, courseworkpercentage, exampercentage,
           grade, overallpercentage
    FROM subjectplanning.subjects
    WHERE id = ?;
  `;

    try {
        const result = await cassandraClient.execute(query, [numericId], { prepare: true });

        return result.rows.map((r) => {
            const fullYear = year2full(r.examyear);   // 20 -> 2020
            const month = Number(r.exammonth);

            const dto: SubjectAttemptDTO = {
                studentId: r.id,
                programmeCode: r.programmecode,
                subjectCode: r.subjectcode,
                subjectName: r.subjectname,
                examYear: fullYear,
                examMonth: month,
                examPeriod: { examYear: fullYear, examMonth: month },
                status: r.status,                       // can be empty → we’ll normalize in Phase 3
                grade: r.grade,
                overallPercentage: r.overallpercentage,
            };

            return dto;
        });
    } catch (err) {
        console.error("[SubjectService] getSubjectAttemptsByStudentId failed:", err);
        return [];
    }
}
