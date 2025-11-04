export type PlanSemester = "JAN" | "APR" | "SEP";

export interface PlannedSubject {
    code: string;              // e.g. "CSC1024"
    name?: string;             // optional; nice to have
    kind?: "core" | "elective" | "unrestricted"; // optional label
}

export interface SemesterPlan {
    sem: PlanSemester;         // JAN/APR/SEP
    subjects: PlannedSubject[];
}

export interface YearPlan {
    yearNumber: 1 | 2 | 3 | 4; // programme year (not calendar year)
    semesters: SemesterPlan[]; // 1–3 entries (JAN/APR/SEP)
}

export interface ProgrammePlan {
    programmeCode: string;     // e.g. "481BCS"
    title?: string;
    years: YearPlan[];         // ordered Y1..Y3/4
}

// A resolve result for a subject against a plan
export interface PlannedLocation {
    yearNumber: number;        // programme year
    sem: PlanSemester;         // JAN/APR/SEP
    indexWithinSem: number;    // position inside the semester array
    kind?: "core" | "elective" | "unrestricted";
}

export interface PlanLookupResult {
    found: boolean;
    location?: PlannedLocation;
    reason?: string;           // helpful error (e.g., "not in plan")
}