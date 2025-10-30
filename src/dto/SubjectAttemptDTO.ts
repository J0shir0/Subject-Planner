import { ExamPeriod } from "./ExamPeriod";

/**
 * Represents a single subject attempt for a student.
 * Each row corresponds to one exam entry (one attempt).
 */
export interface SubjectAttemptDTO {
    studentId: string;          // link to StudentDTO.id
    programmeCode: string;
    subjectCode: string;
    subjectName: string;

    // Exam data
    examYear: number;           // e.g. 2023 (full year)
    examMonth: number;          // e.g. 3 (March)
    examPeriod: ExamPeriod;     // convenience nesting

    // Result status
    status: string;             // e.g. PASS / FAIL / ABSENT / IN_PROGRESS
    grade?: string;
    overallPercentage?: number;

    // Derived values (computed later)
    intake?: "JAN" | "APR" | "SEP";
    intakeYear?: number;
    semesterIndex?: number;
    isAudit?: boolean;          // true if student took outside lineup
    isYearOne?: boolean;        // true if Year 1 subject (special retake rule)
}
