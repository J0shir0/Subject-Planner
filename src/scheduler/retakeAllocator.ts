import type { ProgrammePlan, PlanSemester } from "../dsl/types";
import { nextLongSemesterAfter, sameSemesterNextYear, CREDIT_CAP } from "./rules";
import { mapExamToSemester } from "../utils/semesterMapper";
import { classifyByGrade } from "../utils/attemptClassifier";

// Lightweight view of an attempt we need to schedule
export interface Attempt {
    subjectCode: string;
    subjectName: string;
    grade: string | null;                 // last known grade
    examYear: number;
    examMonth: number;
    planned?: { yearNumber: number; sem: PlanSemester }; // from Phase 4 lookup (if known)
}

export interface ScheduledItem {
    year: number;                         // calendar year
    sem: PlanSemester;                    // JAN/APR/SEP
    subjectCode: string;
    subjectName: string;
    reason: "LINEUP" | "RETAKE";
}

export interface BuildContext {
    currentCalendarYear: number;          // e.g., now or last recorded year
    currentSem?: PlanSemester;
    cohortYear?: number;
    enforceCap?: boolean;
}

/**
 * Decide the retake semester for a *failed* attempt.
 * Year-1: next long semester (maybe same year).
 * Year >1: same semester next year.
 */
export function planRetakeFor(attempt: Attempt): { year: number; sem: PlanSemester } {
    const { calendarYear, examMonth, semesterCode } =
        mapExamToSemester(attempt.examYear, attempt.examMonth);
    const sem = (semesterCode.split("-")[1] as PlanSemester); // e.g., "2018-APR" -> "APR"

    const isYear1 = attempt.planned?.yearNumber === 1;

    if (isYear1) {
        const targetSem = nextLongSemesterAfter(sem);
        // If we jumped from SEP->APR, bump year; else same year
        const nextYear = (sem === "SEP") ? calendarYear + 1 : calendarYear;
        return { year: nextYear, sem: targetSem };
    }

    // Non-Y1: same semester next year
    return { year: calendarYear + 1, sem: sameSemesterNextYear(sem) };
}

/**
 * Build a schedule merging line-up subjects (from DSL plan) + retakes.
 * We keep it simple:
 *   - Add all past PASS attempts as done (not scheduled).
 *   - For FAIL attempts: compute retake target and push into that semester.
 *   - For line-up future semesters: include planned subjects.
 *   - Enforce credit caps by trimming overflow (report overflow list).
 */
export function buildSchedule(
    plan: ProgrammePlan | null,
    attempts: Attempt[],
    ctx: BuildContext
): { schedule: ScheduledItem[]; overflow: ScheduledItem[] } {
    const schedule: ScheduledItem[] = [];
    const overflow: ScheduledItem[] = [];

    // 1) Add RETAKES
    for (const a of attempts) {
        const outcome = classifyByGrade(a.grade).outcome; // PASS / FAIL / UNKNOWN
        if (outcome !== "FAIL") continue;
        const target = planRetakeFor(a);
        schedule.push({
            year: target.year,
            sem: target.sem,
            subjectCode: a.subjectCode,
            subjectName: a.subjectName,
            reason: "RETAKE",
        });
    }

    // 2) Add LINE-UP (future) from programme plan
    if (plan) {
        // Include all planned subjects; production code would exclude
        // already-passed attempts. We’ll exclude passed below by code match.
        for (const y of plan.years) {
            // Derive a calendar baseline from cohort year
            const anchor = ctx.cohortYear ?? ctx.currentCalendarYear;
            const base = (ctx.cohortYear ?? ctx.currentCalendarYear);
            const baseYear = base + (y.yearNumber - 1);
            for (const sem of y.semesters) {
                let calYear = baseYear;
                if (sem.sem === "SEP") calYear = baseYear; // same baseline;
                // If you need exact years from cohort, plug it here.

                for (const subj of sem.subjects) {
                    schedule.push({
                        year: calYear,
                        sem: sem.sem,
                        subjectCode: subj.code,
                        subjectName: subj.name || subj.code,
                        reason: "LINEUP",
                    });
                }
            }
        }
    }

    // 3) Remove duplicates that are already PASSED
    const passedCodes = new Set(
        attempts
            .filter(a => classifyByGrade(a.grade).outcome === "PASS")
            .map(a => a.subjectCode.toUpperCase().trim())
    );

    const seen = new Set<string>();
    const dedup = schedule
        .filter(it => !passedCodes.has(it.subjectCode.toUpperCase().trim()))
        .filter(it => {
            const key = `${it.year}-${it.sem}-${it.subjectCode.toUpperCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

    if (!ctx.enforceCap) {
        const result = [...dedup];
        const order = (s: PlanSemester) => (s === "JAN" ? 0 : s === "APR" ? 1 : 2);
        result.sort((a, b) => a.year !== b.year ? a.year - b.year : order(a.sem) - order(b.sem));
        return { schedule: result, overflow: [] };
    }
    const creditsPer = (it: ScheduledItem) => (it.reason === "LINEUP" ? 4 : 4);

    const buckets = new Map<string, { items: ScheduledItem[]; used: number; cap: number }>();
    for (const it of dedup) {
        const key = `${it.year}-${it.sem}`;
        if (!buckets.has(key)) {
            buckets.set(key, { items: [], used: 0, cap: CREDIT_CAP[it.sem] });
        }
        const b = buckets.get(key)!;
        const c = creditsPer(it);
        if (b.used + c <= b.cap) {
            b.items.push(it);
            b.used += c;
        } else {
            overflow.push(it); // could not fit due to cap; front-end can show warning
        }
    }

    const result: ScheduledItem[] = [];
    for (const { items } of buckets.values()) result.push(...items);

    // Stable sort by year then JAN/APR/SEP
    const order = (s: PlanSemester) => (s === "JAN" ? 0 : s === "APR" ? 1 : 2);
    result.sort((a, b) => a.year !== b.year ? a.year - b.year : order(a.sem) - order(b.sem));

    return { schedule: result, overflow };
}
