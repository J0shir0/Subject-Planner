// src/utils/examPeriods.ts

// A tiny helper to store exam periods exactly like your supervisor did.
export interface ExamPeriodDef {
    shortYear: number;  // e.g. 11 → 2011
    month: number;      // 3, 7, 12, 8, 1, 4...
}

export const examPeriodsList: ExamPeriodDef[] = [
    { shortYear: 11, month: 7 },
    { shortYear: 11, month: 12 },

    { shortYear: 12, month: 7 },
    { shortYear: 12, month: 12 },

    { shortYear: 13, month: 7 },
    { shortYear: 13, month: 12 },

    // 2014 → 3, 7, 12
    { shortYear: 14, month: 3 },
    { shortYear: 14, month: 7 },
    { shortYear: 14, month: 12 },

    { shortYear: 15, month: 3 },
    { shortYear: 15, month: 7 },
    { shortYear: 15, month: 12 },

    { shortYear: 16, month: 3 },
    { shortYear: 16, month: 7 },
    { shortYear: 16, month: 12 },

    { shortYear: 17, month: 3 },
    { shortYear: 17, month: 7 },
    { shortYear: 17, month: 12 },

    { shortYear: 18, month: 3 },
    { shortYear: 18, month: 7 },
    { shortYear: 18, month: 12 },

    { shortYear: 19, month: 3 },
    { shortYear: 19, month: 7 },
    { shortYear: 19, month: 12 },

    { shortYear: 20, month: 3 },
    { shortYear: 20, month: 7 },
    { shortYear: 20, month: 12 },

    { shortYear: 21, month: 3 },
    { shortYear: 21, month: 7 },
    { shortYear: 21, month: 12 },

    { shortYear: 22, month: 3 },
    { shortYear: 22, month: 7 },
    { shortYear: 22, month: 12 },

    // THIS is your odd period (23 → 26) from Scala
    { shortYear: 23, month: 3 },
    { shortYear: 23, month: 8 },
    { shortYear: 24, month: 1 },
    { shortYear: 24, month: 3 },
    { shortYear: 24, month: 8 },
    { shortYear: 25, month: 1 },
    { shortYear: 25, month: 4 },
    { shortYear: 25, month: 8 },
    { shortYear: 26, month: 1 },
];

/**
 * Utility: turn 2-digit year into 4-digit.
 * 11 → 2011, 23 → 2023
 */
export function shortToFullYear(shortYear: number): number {
    return 2000 + shortYear;
}