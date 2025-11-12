import fs from "fs";
import path from "path";
import type { ProgrammePlan } from "./types";
import { parseSubjectPlan } from "./subjectPlanParser";

// Single source of truth for plans. Staff only touch this one folder.
// Default: src/plans (relative to project root). Overridable via PLANS_DIR.
function plansDir(): string {
    const root = process.cwd();                           // project root when you run npm scripts
    const configured = process.env.PLANS_DIR || "src/plans";
    return path.resolve(root, configured);
}

type PlanKey = string; // e.g., "481BCS-SA-2025-01"
const registry = new Map<PlanKey, ProgrammePlan>();

function makeKey(code: string, cohort?: string): PlanKey {
    return cohort ? `${code}-${cohort}` : code;
}

// Load every *.dsl in the folder (Course and Cohort headers are required)
export function loadAllPlans(): void {
    registry.clear();
    const dir = plansDir();

    if (!fs.existsSync(dir)) {
        console.warn(`[plans] directory does not exist: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith(".dsl"));
    if (files.length === 0) {
        console.warn(`[plans] no *.dsl files found in ${dir}`);
        return;
    }

    for (const file of files) {
        const full = path.join(dir, file);
        try {
            const raw = fs.readFileSync(full, "utf8");
            const plan = parseSubjectPlan(raw);
            const apr2025 = plan.years
                .flatMap(y => y.semesters
                    .filter(s => s.sem === "APR")
                    .flatMap(s => s.subjects.map(x => x.code)));
            console.log("[plans] 2025-APR codes:", apr2025);
            if (!plan.programmeCode) { console.warn(`[plans] ${file}: missing Course:`); continue; }
            if (!plan.cohort)        { console.warn(`[plans] ${file}: missing Cohort:`); continue; }
            const key = makeKey(plan.programmeCode, plan.cohort);
            registry.set(key, plan);                 // exact cohort
            registry.set(plan.programmeCode, plan);  // programme-only fallback (latest wins)
            console.log(`[plans] loaded ${key}`);
        } catch (e: any) {
            console.error(`[plans] failed to load ${file}: ${e.message || e}`);
        }
    }
}

export function getPlan(programmeCode: string, cohort?: string): ProgrammePlan | null {
    if (cohort) {
        const exact = registry.get(makeKey(programmeCode, cohort));
        if (exact) return exact;
    }
    return registry.get(programmeCode) || null;
}

export function listPlans(): Array<{ key: string; programmeCode: string; cohort?: string }> {
    const out: Array<{ key: string; programmeCode: string; cohort?: string }> = [];
    for (const [key, plan] of registry.entries()) {
        // only list the exact key (programme + cohort), not the programme-only alias
        const exactKey = makeKey(plan.programmeCode, plan.cohort);
        if (key === exactKey) {
            out.push({ key, programmeCode: plan.programmeCode, cohort: plan.cohort });
        }
    }
    return out.sort((a, b) => a.key.localeCompare(b.key));
}