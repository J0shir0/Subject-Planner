export type CanonicalSem = "JAN" | "APR" | "SEP";

export const CREDIT_CAP: Record<CanonicalSem, number> = {
    JAN: 10,   // short semester
    APR: 19,   // long
    SEP: 19,   // long
} as const;

// If a Year-1 subject is failed, place it in the NEXT long sem.
// JAN → APR (same year), APR → SEP (same year), SEP → APR (next year)
export function nextLongSemesterAfter(sem: CanonicalSem): CanonicalSem {
    if (sem === "JAN") return "APR";
    if (sem === "APR") return "SEP";
    return "APR"; // from SEP jump to next year's APR
}

// For non-Y1: reattempt in the *same* semester, next year.
export function sameSemesterNextYear(sem: CanonicalSem): CanonicalSem {
    return sem; // code that uses this will bump the year
}
