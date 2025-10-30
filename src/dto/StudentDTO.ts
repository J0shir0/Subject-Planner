/**
 * Clean representation of a student as read from Cassandra.
 * Some columns are simplified or renamed for clarity.
 */
export interface StudentDTO {
    id: string;            // unique student ID
    ic: string;            // identification number (for login)
    name: string;
    programme: string;
    programmeCode: string;
    cohort: string;        // e.g. "2023JAN"
    cohortYear: number;    // e.g. 2023 (derived from cohort)
    gender?: string;
    status?: string;       // e.g. "Active", "Graduated"
    graduated?: boolean;
    overallCGPA?: number;
    awardClassification?: string;
    sponsorName?: string;
    country?: string;
}
