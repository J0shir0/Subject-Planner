export type PlanSem = "JAN" | "APR" | "SEP";

export interface ScheduleItem {
    year: number;
    sem: PlanSem;
    subjectCode: string;
    subjectName: string;
    reason: "LINEUP" | "RETAKE";
}

export interface StudentLite {
    studentId: number;
    name?: string | null;
    programmeCode: string;
    cohort: string; // "YYYY-MM"
}

export interface SchedulePayload {
    student: StudentLite;
    schedule: ScheduleItem[];
    overflow: ScheduleItem[];
    generatedAt: string;
}
