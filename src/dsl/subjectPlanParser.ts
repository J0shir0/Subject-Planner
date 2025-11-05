import type {
    ProgrammePlan, YearPlan, SemesterPlan, PlanSemester, PlannedSubject,
} from "./types";

function monthToSem(yyyyDashMm: string): PlanSemester {
    const m = Number(yyyyDashMm.slice(5, 7));
    if (m === 1) return "JAN";
    if (m === 4) return "APR";
    if (m === 9) return "SEP";
    // special shifts you told me about:
    if (m === 3) return "JAN";
    if (m === 8) return "APR";
    return "APR";
}

function parseModuleLine(text: string): { code: string; name: string; credits?: number } {
    const cred = text.match(/\[(\d+)\]\s*$/);
    const credits = cred ? Number(cred[1]) : undefined;
    const noCred = text.replace(/\s*\[\d+\]\s*$/, "");
    const parts = noCred.trim().split(/\s+/, 2);
    const code = (parts[0] || "").trim();
    const name = (parts[1] || "").trim() || code;
    return { code, name, credits };
}

type GroupKind = "elective" | "altpool" | "unireq";

function inferYearFromSemIndex(semIdx: number): 1 | 2 | 3 | 4 {
    if (semIdx <= 3) return 1;
    if (semIdx <= 6) return 2;
    if (semIdx <= 9) return 3;
    return 4;
}

/** Parse your wookeat-style DSL text into an internal ProgrammePlan. */
export function parseSubjectPlan(dslText: string): ProgrammePlan {
    const text = dslText.replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/);

    let programmeCode = "UNKNOWN";
    let cohort: string | undefined = undefined;
    // extend SemesterPlan locally with an internal `_idx`
    let currentSem: (SemesterPlan & { _idx: number }) | null = null;
    let currentYearNum = 0; // inferred from Sem-X
    let currentGroup: { kind: GroupKind; pick: number; items: PlannedSubject[] } | null = null;

    const years = new Map<number, YearPlan>();

    const flushGroup = () => {
        if (currentGroup && currentSem) currentSem.subjects.push(...currentGroup.items);
        currentGroup = null;
    };

    const commitSem = () => {
        if (!currentSem) return;
        const y = currentYearNum || inferYearFromSemIndex(currentSem._idx);
        const existing = years.get(y) ?? { yearNumber: y as 1 | 2 | 3 | 4, semesters: [] };
        existing.semesters.push({ sem: currentSem.sem, subjects: currentSem.subjects });
        years.set(y, existing);
        currentSem = null;
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith("Cohort:")) {
            cohort = line.slice(7).trim();          // e.g., "2025-01"
            continue;
        }
        if (line.startsWith("Date:") || line === "Modules:") {
            continue;
        }

        const courseHit = line.match(/^course\s*:\s*(.+)$/i);
        if (courseHit) { programmeCode = courseHit[1].trim(); continue; }

        const cohortHit = line.match(/^cohort\s*:\s*(.+)$/i);
        if (cohortHit) { cohort = cohortHit[1].trim(); continue; }

        if (/^date\s*:/.test(line)) continue;
        if (line.toLowerCase() === "modules:") continue;

        // Sem-4 (2025-01):
        const semMatch = line.match(/^Sem-(\d+)\s*\((\d{4}-\d{2})\):$/i);
        if (semMatch) {
            flushGroup();
            commitSem();
            const idx = Number(semMatch[1]);      // N from Sem-N
            const yyyymm = semMatch[2];           // YYYY-MM
            currentYearNum = 0;                   // keep inferring
            currentSem = { _idx: idx, sem: monthToSem(yyyymm), subjects: [] };
            continue;
        }

        // group header: "* Year-2 {1}" | "# Year-2 {1}" | "? Year-2 {1}"
        const grp = line.match(/^([*#?])\s*.+?\{(\d+)\}\s*$/);
        if (grp) {
            flushGroup();
            if (!currentSem) continue;
            const pick = Number(grp[2]);
            const sym = grp[1];
            const kind: GroupKind = sym === "*" ? "elective" : sym === "#" ? "altpool" : "unireq";
            currentGroup = { kind, pick, items: [] };
            continue;
        }

        // required: "! CODE Name [4]"
        if (line.startsWith("! ")) {
            if (!currentSem) continue;
            const mod = parseModuleLine(line.slice(2));
            currentSem.subjects.push({ code: mod.code, name: mod.name, kind: "core" });
            continue;
        }

        // group item: "+ CODE Name [4]"
        if (line.startsWith("+ ")) {
            const mod = parseModuleLine(line.slice(2));
            const subject: PlannedSubject = { code: mod.code, name: mod.name };
            if (currentGroup) {
                subject.kind = currentGroup.kind === "unireq" ? "unrestricted" : "elective";
                currentGroup.items.push(subject);
            } else if (currentSem) {
                subject.kind = "elective";
                currentSem.subjects.push(subject);
            }
            continue;
        }
    }

    flushGroup();
    commitSem();

    // sort semesters JAN, APR, SEP inside each year
    const order = (s: PlanSemester) => (s === "JAN" ? 0 : s === "APR" ? 1 : 2);

    const yearsArr: YearPlan[] = Array.from(years.values())
        .sort((a, b) => a.yearNumber - b.yearNumber)
        .map(y => ({
            ...y,
            semesters: y.semesters.sort((a, b) => order(a.sem) - order(b.sem)),
        }));

    return { programmeCode, cohort, years: yearsArr };
}