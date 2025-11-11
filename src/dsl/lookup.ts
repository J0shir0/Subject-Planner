import type { ProgrammePlan } from "./types";

export interface FoundLocation {
    yearNumber: number;
    sem: "JAN" | "APR" | "SEP";
}
/**
 * Search for a subject code inside a ProgrammePlan and return where it was found.
 */
export function findSubjectInPlan(plan: ProgrammePlan, subjectCode: string):
    { found: true; location: FoundLocation; subject: any } |
    { found: false; location?: undefined } {
    const codeNorm = subjectCode.trim().toUpperCase();

    for (const year of plan.years) {
        for (const sem of year.semesters) {
            for (const subj of sem.subjects) {
                if (subj.code.trim().toUpperCase() === codeNorm) {
                    return {
                        found: true,
                        location: { yearNumber: year.yearNumber, sem: sem.sem },
                        subject: subj,
                    };
                }
            }
        }
    }

    return { found: false };
}
