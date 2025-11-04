import { getStudentSemesterProgress } from "../services/progressService";
import { mapExamToSemester } from "../utils/semesterMapper";
import { nextLongSemesterForYear1, sameSemesterNextYear, CanonicalSemester} from "./semesterTimeline";

/**
 * A retake item is: which subject failed, and where we plan to put it.
 */
export interface RetakePlanItem {
    subjectCode: string;
    subjectName: string;
    originalSemester: string;  // e.g. "2019-APR"
    reason: string;            // e.g. "Year 2+ → same sem next year"
    retakeIn: {
        year: number;
        sem: CanonicalSemester;
        code: string;            // e.g. "2020-APR"
    };
}

/**
 * Decide if a subject is Year 1 or not.
 * For now we approximate: if examYear === cohortYear → Year 1
 * (We can refine this later when DSL/line-up is wired in.)
 */
function isYearOneSubject(examYear: number, studentCohortYear: number): boolean {
    return examYear === studentCohortYear;
}

/**
 * Main API: for a given student, return list of failed/missed subjects
 * and the semester they should be retaken in, based on your supervisor's rule.
 */
export async function buildRetakePlanForStudent(
    studentId: number | string,
    studentCohortYear: number
): Promise<RetakePlanItem[]> {
    const semesterBuckets = await getStudentSemesterProgress(studentId);

    const retakes: RetakePlanItem[] = [];

    for (const bucket of semesterBuckets) {
        const currentSemCode = bucket.semesterCode; // e.g. "2019-APR"
        const currentYear = bucket.calendarYear;
        const currentSem = currentSemCode.slice(5) as CanonicalSemester; // crude but works: "2019-APR" -> "APR"

        for (const subj of bucket.subjects) {
            if (subj.outcome !== "FAIL" || subj.kind === "RESIT") continue;

            const isY1 = isYearOneSubject(currentYear, studentCohortYear);

            const retakeRef = isY1
                ? nextLongSemesterForYear1(currentYear, currentSem)
                : sameSemesterNextYear(currentYear, currentSem);

            retakes.push({
                subjectCode: subj.subjectCode,
                subjectName: subj.subjectName,
                originalSemester: currentSemCode,
                reason: isY1
                    ? "Year 1 → can retake in next long sem"
                    : "Year 2+ → must retake in same sem next year",
                retakeIn: retakeRef,
            });
        }
    }

    return retakes;
}
