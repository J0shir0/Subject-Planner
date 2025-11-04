import { getSubjectAttemptsByStudentId } from "./subjectService";
import { mapExamToSemester } from "../utils/semesterMapper";
import { classifyByGrade, AttemptOutcome, parseAttemptKind, AttemptKind } from "../utils/attemptClassifier";

interface SemesterBucket {
    semesterCode: string;      // e.g. "2020-JAN"
    calendarYear: number;      // 2020
    examMonth: number;         // 3
    subjects: Array<{
        subjectCode: string;
        subjectName: string;
        grade: string | null | undefined;
        outcome: AttemptOutcome;
        kind: AttemptKind
    }>;
    // rollup
    passedCount: number;
    failedCount: number;
    unknownCount: number;
}

/**
 * Build a per-semester view of a student's subjects.
 * Input: studentId (number) -> fetch subjects -> group -> summarize.
 */
export async function getStudentSemesterProgress(studentId: number | string): Promise<SemesterBucket[]> {
    const attempts = await getSubjectAttemptsByStudentId(studentId);

    // bucket by semester code
    const buckets = new Map<string, SemesterBucket>();

    for (const a of attempts) {
        const mapped = mapExamToSemester(a.examYear, a.examMonth);
        const key = mapped.semesterCode; // e.g. 2020-JAN

        const classification = classifyByGrade(a.grade);
        const kind = parseAttemptKind((a as any).status);

        if (!buckets.has(key)) {
            buckets.set(key, {
                semesterCode: mapped.semesterCode,
                calendarYear: mapped.calendarYear,
                examMonth: mapped.examMonth,
                subjects: [],
                passedCount: 0,
                failedCount: 0,
                unknownCount: 0,
            });
        }

        const bucket = buckets.get(key)!;


        bucket.subjects.push({
            subjectCode: a.subjectCode,
            subjectName: a.subjectName,
            grade: a.grade ?? null,
            outcome: classification.outcome,
            kind,
        });

        // rollup counters
        switch (classification.outcome) {
            case "PASS":
                bucket.passedCount += 1;
                break;
            case "FAIL":
                bucket.failedCount += 1;
                break;
            default:
                bucket.unknownCount += 1;
                break;
        }
    }

    // turn Map → array and sort by year/month
    const result = Array.from(buckets.values()).sort((a, b) => {
        if (a.calendarYear !== b.calendarYear) {
            return a.calendarYear - b.calendarYear;
        }
        return a.examMonth - b.examMonth;
    });

    return result;
}
