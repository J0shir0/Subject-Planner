import type {
    ProgrammePlan, YearPlan, SemesterPlan, PlanSemester, PlannedSubject,
} from "./types";

/** Map a YYYY-MM to the uni semester code. */
function monthToSem(yyyyDashMm: string): PlanSemester {
    const m = Number(yyyyDashMm.slice(5, 7));
    // canonical
    if (m === 1) return "JAN";
    if (m === 4) return "APR";
    if (m === 9) return "SEP";
    // supervisor’s “shifted” months
    if (m === 3) return "JAN";  // late short-sem exams
    if (m === 8) return "APR";  // April sem with Aug exams
    // fallback (rare)
    return "APR";
}

/**
 * Parse a subject line after stripping the leading marker ("! " or "+ ").
 * Supports codes like "MPU3212" or "MPU 3212" and keeps the full name.
 * Examples accepted:
 *   "MPU 3212 Critical Thinking [2]"
 *   "CSC2103 Data Structure & Algorithms [4]"
 */
function parseModuleLine(text: string): { code?: string; name?: string; credits?: number } {
    let credits: number | undefined;
    const noCred = text.replace(/\s*\[(\d+)\]\s*$/, (_m, g1) => {
        credits = Number(g1);
        return "";
    });

    // CODE = letters+digits(+optional trailing letter), allowing internal spaces before digits.
    // NAME  = the rest
    const trimmed = noCred.trim();

    // 1) split once at the first whitespace run
    const firstSpace = trimmed.search(/\s+/);
    if (firstSpace <= 0) return {}; // no name part -> malformed

    const rawCode = trimmed.slice(0, firstSpace);      // e.g. "MPU", "CSC2103", "MPU3332"
    const rest = trimmed.slice(firstSpace).trim(); // the name part

    // If the code was split like "MPU 3332", pull next numeric chunk
    let codeCandidate = rawCode;
    if (/^[A-Za-z]+$/.test(rawCode)) {
        const m2 = rest.match(/^(\d{3,4}[A-Za-z]?)(?:\s+|$)(.*)$/);
        if (m2) {
            codeCandidate = (rawCode + m2[1]);       // "MPU" + "3332" -> "MPU3332"
            return { code: codeCandidate.toUpperCase(), name: (m2[2] || "").trim(), credits };
        }
    }

    // Normal case: already “CSC2103 …” or “MPU3332 …”
    if (/^[A-Za-z]{2,}\d{3,4}[A-Za-z]?$/.test(codeCandidate)) {
        return { code: codeCandidate.toUpperCase(), name: rest, credits };
    }

    // Fallback: collapse spaces inside code and try again
    const collapsed = codeCandidate.replace(/\s+/g, "");
    if (/^[A-Za-z]{2,}\d{3,4}[A-Za-z]?$/.test(collapsed)) {
        return { code: collapsed.toUpperCase(), name: rest, credits };
    }

    return {};
}

type GroupKind = "elective" | "altpool" | "unireq";

function inferYearFromSemIndex(semIdx: number): 1 | 2 | 3 | 4 {
    if (semIdx <= 3) return 1;
    if (semIdx <= 6) return 2;
    if (semIdx <= 9) return 3;
    return 4;
}

/** Parse the wookeat-style DSL into an internal ProgrammePlan. */
export function parseSubjectPlan(dslText: string): ProgrammePlan {
    const text = dslText.replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/);

    let programmeCode = "UNKNOWN";
    let cohort: string | undefined = undefined;

    // extend SemesterPlan locally with an internal index to infer year
    let currentSem: (SemesterPlan & { _idx: number }) | null = null;
    let currentYearNum = 0;
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

        // headers (case-insensitive)
        if (line.toLowerCase().startsWith("cohort:")) { cohort = line.slice(7).trim(); continue; }
        if (line.toLowerCase().startsWith("course:")) { programmeCode = line.slice(7).trim(); continue; }
        if (line.toLowerCase().startsWith("date:")) continue;
        if (line.toLowerCase() === "modules:") continue;

        // Sem-4 (2025-01):
        const semMatch = line.match(/^Sem-(\d+)\s*\((\d{4}-\d{2})\):$/i);
        if (semMatch) {
            flushGroup();
            commitSem();
            const idx = Number(semMatch[1]);
            const yyyymm = semMatch[2];
            currentYearNum = 0; // keep inferring
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
            if (!mod.code || !mod.name) {
                console.warn(`[dsl] skipped malformed required line: ${line}`);
                continue;
            }
            currentSem.subjects.push({ code: mod.code, name: mod.name, kind: "core" });
            continue;
        }

        // group item: "+ CODE Name [4]"
        if (line.startsWith("+ ")) {
            const mod = parseModuleLine(line.slice(2));
            if (!mod.code || !mod.name) {
                console.warn(`[dsl] skipped malformed elective line: ${line}`);
                continue;
            }
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
