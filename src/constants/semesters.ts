// Canonical semester/intake vocabulary used across the backend.

export enum INTAKE {
    JAN = "JAN",
    APR = "APR",
    SEP = "SEP",
}

// Some parts of the engine refer to a rolling 3-slot wheel: A (Jan), B (Apr), C (Sep)
export enum SEM {
    A = "A", // Jan
    B = "B", // Apr
    C = "C", // Sep
}

// Stable mappings (don’t change these unless your institution renames intakes)
export const SEM_TO_INTAKE: Record<SEM, INTAKE> = {
    [SEM.A]: INTAKE.JAN,
    [SEM.B]: INTAKE.APR,
    [SEM.C]: INTAKE.SEP,
};

export const INTAKE_TO_SEM: Record<INTAKE, SEM> = {
    [INTAKE.JAN]: SEM.A,
    [INTAKE.APR]: SEM.B,
    [INTAKE.SEP]: SEM.C,
};

// Human labels for UI/diagnostics
export const INTAKE_LABEL: Record<INTAKE, string> = {
    [INTAKE.JAN]: "January (Short)",
    [INTAKE.APR]: "April (Long)",
    [INTAKE.SEP]: "September (Long)",
};

// Helpers you’ll likely use everywhere

/** Rotate A→B→C→A… (useful for building semester wheels). */
export function nextSem(sem: SEM): SEM {
    switch (sem) {
        case SEM.A: return SEM.B;
        case SEM.B: return SEM.C;
        case SEM.C: return SEM.A;
    }
}

/** Same semester next academic year = index + 3 in the wheel logic. */
export function addYearSameSemester(semIndex: number): number {
    return semIndex + 3;
}

/** Returns the ordered cycle [JAN, APR, SEP] starting from JAN. */
export function intakeCycle(): INTAKE[] {
    return [INTAKE.JAN, INTAKE.APR, INTAKE.SEP];
}

/** Given a SEM, return its intake label (for logs/diagnostics). */
export function labelSem(sem: SEM): string {
    return INTAKE_LABEL[SEM_TO_INTAKE[sem]];
}
