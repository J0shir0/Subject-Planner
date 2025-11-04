export type AttemptOutcome = "PASS" | "FAIL" | "UNKNOWN";

export interface ClassifiedAttempt {
    outcome: AttemptOutcome;
    reason: string; // helpful for debugging
}

export type AttemptKind = "ATTEMPT" | "RESIT" | "REPEAT";

export function parseAttemptKind(status: string | null | undefined): AttemptKind {
    const s = (status || "").trim().toUpperCase();
    if (s.startsWith("RS")) return "RESIT";
    if (s.startsWith("RP")) return "REPEAT";
    return "ATTEMPT";
}

/**
 * Temporary logic (until we understand RS2 / RP3):
 * - grade === 'F'          → FAIL
 * - grade is non-empty     → PASS
 * - otherwise              → UNKNOWN
 */
export function classifyByGrade(grade: string | null | undefined): ClassifiedAttempt {
    const g = (grade || "").trim().toUpperCase();

    if (!g) {
        return { outcome: "UNKNOWN", reason: "No grade value" };
    }

    if (g.startsWith("F")) {
        return { outcome: "FAIL", reason: "Grade is F" };
    }

    // A, B, C, D, P, A-, B+, etc. → all treated as pass
    return { outcome: "PASS", reason: `Grade is ${g}` };
}