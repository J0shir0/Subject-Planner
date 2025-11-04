import { examPeriodsList, shortToFullYear } from "./examPeriods";

// canonical names we already decided in Phase 0
export type SemesterName = "JAN" | "APR" | "SEP" | "AUG" | "MAR" | "UNKNOWN";

export interface MappedSemester {
    semester: SemesterName;     // e.g. "JAN"
    calendarYear: number;       // e.g. 2020
    examMonth: number;          // e.g. 3
    semesterCode: string;       // e.g. "2020-JAN"
    // rolling index: 0,1,2,3,... in chronological order (optional, but useful)
    index?: number;
}

/**
 * Basic month → semester mapping for the "normal" years (≈ 2014–2022).
 */
function monthToSemesterDefault(month: number): SemesterName {
    switch (month) {
        case 3:
            return "JAN";
        case 7:
            return "APR";
        case 12:
            return "SEP";
        default:
            return "UNKNOWN";
    }
}

/**
 * Main entry:
 * Given an exam year (full, e.g. 2020) and exam month (3,7,12,8,1,4),
 * return the canonical semester info.
 */
export function mapExamToSemester(examYear: number, examMonth: number): MappedSemester {
    // 1) 2023+ has special months → handle first
    if (examYear >= 2023) {
        const sem = mapSpecial2023onward(examYear, examMonth);
        return {
            semester: sem,
            calendarYear: examYear,
            examMonth,
            semesterCode: `${examYear}-${sem}`,
        };
    }

    // 2) Otherwise, normal rule (2011–2022): 3→JAN, 7→APR, 12→SEP
    const semester = monthToSemesterDefault(examMonth);
    return {
        semester,
        calendarYear: examYear,
        examMonth,
        semesterCode: `${examYear}-${semester}`,
    };
}

/**
 * Special mapping for 2023+ based on your supervisor’s list.
 * 2023: 3 → MAR (we treat as JAN-sem), 8 → AUG (we treat as SEP-sem)
 * 2024: 1 → JAN, 3 → MAR, 8 → AUG
 * 2025: 1 → JAN, 4 → APR, 8 → AUG
 * 2026: 1 → JAN
 *
 * We'll keep the actual month names so we can display real timetable later.
 */
function mapSpecial2023onward(year: number, month: number): SemesterName {
    // 2023 had JAN exams in Mar (3) and APR exams in Aug (8)
    if (year === 2023) {
        if (month === 3) return "JAN";
        if (month === 8) return "APR";
    }
    // 2024: Jan exam in Mar (3); Apr exam in Aug (8); Sep23 exam in Jan24 (1)
    if (year === 2024) {
        if (month === 1) return "SEP"; // SEP 2023 intake, exam Jan 2024
        if (month === 3) return "JAN"; // JAN 2024 intake, exam Mar
        if (month === 8) return "APR"; // APR 2024 intake, exam Aug
    }
    // 2025: Jan short started Feb, exam Apr (4); Apr exam Aug (8); Sep24 exam Jan25 (1)
    if (year === 2025) {
        if (month === 1) return "SEP"; // SEP 2024 intake, exam Jan 2025
        if (month === 4) return "JAN"; // JAN 2025 short, exam Apr
        if (month === 8) return "APR"; // APR 2025 intake, exam Aug
    }
    // 2026: Sep25 exam Jan26 (1)
    if (year === 2026) {
        if (month === 1) return "SEP";
    }
    return "UNKNOWN";
}