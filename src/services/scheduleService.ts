import { getStudentById } from "./studentService";
import { getSubjectAttemptsByStudentId } from "./subjectService";
import { getPlan } from "../dsl/registry";
import { findSubjectInPlan } from "../dsl/lookup";
import { buildSchedule } from "../scheduler/retakeAllocator";
import { cacheRead, cacheWrite } from "../utils/cache";

type ApiScheduleItem = {
    year: number;
    sem: "JAN" | "APR" | "SEP";
    subjectCode: string;
    subjectName: string;
    reason: "LINEUP" | "RETAKE";
};

type ApiSchedule = {
    studentId: number;
    programmeCode: string;
    cohort: string;            // "YYYY-MM"
    generatedAt: string;       // ISO
    schedule: ApiScheduleItem[];
};

function normalizeCohort(raw: string | undefined | null): string {
    const m = String(raw || "").match(/^(\d{4})(?:-?)(\d{2})$/);
    return m ? `${m[1]}-${m[2]}` : "";
}

export async function computeAndPersistSchedule(studentId: number): Promise<ApiSchedule> {
    // Try cache first (superfast dev loop)
    const cached = cacheRead<ApiSchedule>(`schedule_${studentId}`);
    if (cached) return cached;

    const student = await getStudentById(studentId);
    const attemptsRaw = await getSubjectAttemptsByStudentId(studentId);

    const programmeCode =
        student?.programmeCode ?? attemptsRaw[0]?.programmeCode ?? "UNKNOWN";
    const cohort = normalizeCohort(student?.cohort);
    const cohortYear = Number((student?.cohort || "").toString().slice(0,4))
        || new Date().getFullYear();

    const plan = programmeCode ? getPlan(programmeCode, cohort) : null;

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

    const nowYear = new Date().getFullYear();
    const { schedule } = buildSchedule(plan, attempts, {
        currentCalendarYear: nowYear,
        cohortYear,
        enforceCap: false,            // per supervisor guidance
    });

    const payload: ApiSchedule = {
        studentId,
        programmeCode,
        cohort,
        generatedAt: new Date().toISOString(),
        schedule: schedule.map(s => ({
            year: s.year, sem: s.sem,
            subjectCode: s.subjectCode,
            subjectName: s.subjectName,
            reason: s.reason
        })),
    };

    cacheWrite(`schedule_${studentId}`, payload);
    return payload;
}
