export type CanonicalSemester = "JAN" | "APR" | "SEP" | "UNKNOWN";

export interface SemesterRef {
    year: number;              // e.g. 2019
    sem: CanonicalSemester;    // "JAN" | "APR" | "SEP"
    code: string;              // e.g. "2019-APR"
}

export function makeSemesterRef(year: number, sem: CanonicalSemester): SemesterRef {
    return {
        year,
        sem,
        code: `${year}-${sem}`,
    };
}

// JAN is short, APR + SEP are long (your earlier description)
export function isLongSemester(sem: CanonicalSemester): boolean {
    return sem === "APR" || sem === "SEP";
}

/**
 * For Year 1 subjects:
 * - if failed in JAN → retake in APR (same year)
 * - if failed in APR → retake in SEP (same year)
 * - if failed in SEP → retake in APR (next year)  ← because same year has no more long sems
 */
export function nextLongSemesterForYear1(currentYear: number, currentSem: CanonicalSemester): SemesterRef {
    if (currentSem === "JAN") {
        return makeSemesterRef(currentYear, "APR");
    }
    if (currentSem === "APR") {
        return makeSemesterRef(currentYear, "SEP");
    }
    if (currentSem === "SEP") {
        // next year's first long = APR
        return makeSemesterRef(currentYear + 1, "APR");
    }
    // fallback
    return makeSemesterRef(currentYear, "APR");
}

/**
 * For Year 2+ subjects:
 * - if failed in JAN 2019 → retake JAN 2020
 * - if failed in APR 2019 → retake APR 2020
 * - if failed in SEP 2019 → retake SEP 2020
 */
export function sameSemesterNextYear(currentYear: number, currentSem: CanonicalSemester): SemesterRef {
    return makeSemesterRef(currentYear + 1, currentSem);
}
