function normalize(text) {
    return text
        .replace(/\uFEFF/g, '')     // BOM
        .replace(/\uFF1A/g, ':')    // full-width colon → :
        .replace(/[–—−]/g, '-')     // en/em/minus → hyphen
        .replace(/\t/g, '    ');    // tabs → 4 spaces
}

const INDENT = 4;

function parseLine(raw) {
    const s = raw.replace(/\t/g, '    ');
    const m = s.match(/^( *)(.*)$/);
    return { indent: m ? m[1].length : 0, text: m ? m[2].trim() : s.trim() };
}

function parseCredits(text) {
    const m = text.match(/\[(\d+)\]\s*$/);
    return m ? Number(m[1]) : 3;
}

// Parse "CODE Title [cr]" where CODE may be like "PRG2104", "PRG 2104", "MPU 3212"
function parseModule(text) {
    const rest = text.trim();

    // Try code with optional single space between letters and digits (e.g., "PRG 2104")
    let m =
        rest.match(/^([A-Za-z]{2,6}\s?\d{3,4}[A-Za-z0-9-]*)\s+(.*)$/) ||
        // Fallback: old simple token (no space in code)
        rest.match(/^([A-Za-z0-9\-_.]+)\s+(.*)$/);

    if (!m) return null;

    const codeRaw = m[1];
    const titleWithCr = m[2];
    const credits = parseCredits(titleWithCr);
    const title = titleWithCr.replace(/\s*\[\d+\]\s*$/, '').trim();

    // Normalize code by collapsing internal spaces (so "PRG 2104" → "PRG2104" for id)
    const code = codeRaw.replace(/\s+/g, '');

    return { code, title, credits };
}

function markerToType(marker) {
    if (marker === '!') return 'core';
    if (marker === '*') return 'discipline';
    if (marker === '#') return 'free';
    if (marker === '?') return 'mpu';
    return 'core';
}

/**
 * Returns:
 * {
 *   plan: [{ year, semesters: [{ id, title, subjects: [] }, ...] }],
 *   buckets: { [bucketId]: [{ subjectId, title, credits }, ...] }
 * }
 */
export function parseSubjectPlanDSL(text) {
    const lines = normalize(text).split(/\r?\n/);

    // year -> { year, semesters: Map(semLocal -> { id,title,subjects:[] }), groupCounter: Map(semLocal -> n) }
    const years = new Map();
    const buckets = new Map(); // bucketId -> options[]

    let inModules = false;
    let currentSem = null;    // { year, semLocal }
    let currentGroup = null;  // { bucketId }

    function ensureYear(year) {
        if (!years.has(year)) {
            years.set(year, { year, semesters: new Map(), groupCounter: new Map() });
        }
        return years.get(year);
    }

    function nextGroupIndex(yearEntry, semLocal) {
        const gc = yearEntry.groupCounter;
        const current = gc.get(semLocal) || 0;
        gc.set(semLocal, current + 1);
        return current + 1;
    }

    for (const raw of lines) {
        const { indent, text: t } = parseLine(raw);
        if (!t) continue;

        // "Modules:" (allow "Modules :" too)
        if (!inModules && /^Modules\s*:\s*$/.test(t)) {
            inModules = true;
            continue;
        }
        if (!inModules) continue;

        // ---- Semester header: allow any indent >= 4; "Sem-4 (2025-01):" or "Sem 4 (2025):"
        if (indent >= INDENT && /^Sem[- ]\d+ \(\d{4}(?:-\d{2})?\):$/.test(t)) {
            currentGroup = null;

            const semRaw = Number(t.match(/^Sem[- ](\d+)/)[1]);
            const semLocal = ((semRaw - 1) % 3) + 1; // normalize to 1..3 per year

            const ym = t.match(/\((\d{4})(?:-(\d{2}))?\)/);
            const year = Number(ym[1]);
            const month = ym[2] ? Number(ym[2]) : null;

            const title = month
                ? `Sem ${semLocal} (${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')})`
                : `Sem ${semLocal} (${year})`;

            const semId = `y${year}-s${semLocal}`;
            const y = ensureYear(year);
            y.semesters.set(semLocal, { id: semId, title, subjects: [] });
            currentSem = { year, semLocal };
            continue;
        }

        // If we're not inside a semester, ignore lines
        if (!currentSem) continue;

        const y = years.get(currentSem.year);
        const semObj = y.semesters.get(currentSem.semLocal);

        // ---- Group header (lenient indent)
        const gm = (indent >= INDENT * 2) && t.match(/^([!*#?])\s+(.+?)?\s*\{(\d+)\}\s*$/);
        if (gm) {
            const marker = gm[1];
            const required = Number(gm[3]) || 1;
            const type = markerToType(marker);

            const gIndex = nextGroupIndex(y, currentSem.semLocal);
            const bucketId = `${type}-y${currentSem.year}-s${currentSem.semLocal}-g${gIndex}`;
            // For MPU groups we do NOT create selectable slots — they are fixed core subjects.
            if (type === 'mpu') {
                currentGroup = { bucketId, isMpu: true, required };
            } else {
                currentGroup = { bucketId, isMpu: false, required };
                if (!buckets.has(bucketId)) buckets.set(bucketId, []);
                // Create N selectable slots only for true electives
                for (let i = 0; i < required; i++) {
                    semObj.subjects.push({
                        id: `${bucketId}-slot-${i + 1}`,
                        code: 'ELECTIVE',
                        name: type === 'discipline' ? 'Discipline Elective' :
                            type === 'free'       ? 'Free Elective' : 'Elective',
                        credits: null,
                        status: 'Planned',
                        type: 'elective',
                        bucketId,
                        slotKind: type
                    });
                }
            }
            continue;
        }

        // ---- Option lines inside a group: "+ CODE Title [cr]"
        if (currentGroup && indent >= INDENT * 3 && /^\+\s+/.test(t)) {
            const info = parseModule(t.slice(1));
            if (info) {
                if (currentGroup.isMpu) {
                    // MPU option → add directly as a core subject (non-selectable)
                    semObj.subjects.push({
                        id: info.code,
                        code: info.code,
                        name: info.title,
                        credits: info.credits,
                        status: 'Planned',
                        type: 'mpu'
                    });
                } else {
                    // True elective option → goes into bucket
                    buckets.get(currentGroup.bucketId).push({
                        subjectId: info.code,
                        title: info.title,
                        credits: info.credits
                    });
                }
            }
            continue;
        }

        // ---- Core / single-line module (lenient indent): "! CODE ..." or bare "CODE ..."
        if (indent >= INDENT * 2) {
            if (/^[!*#?]\s+/.test(t)) {
                // Only "!" is a proper single-line core in plan view
                const marker = t[0];
                const info = parseModule(t.slice(1));
                if (info) {
                    semObj.subjects.push({
                        id: info.code,
                        code: info.code,
                        name: info.title,
                        credits: info.credits,
                        status: 'Planned',
                        type: marker === '!' ? 'core' : 'core'
                    });
                }
                continue;
            }

            // Bare "CODE Title [n]" → treat as core
            const bare = t.match(/^([A-Za-z0-9][A-Za-z0-9 ]{0,15})\s+.+\[\d+\]\s*$/);
            if (bare) {
                const info = parseModule(t);
                if (info) {
                    semObj.subjects.push({
                        id: info.code,
                        code: info.code,
                        name: info.title,
                        credits: info.credits,
                        status: 'Planned',
                        type: 'core'
                    });
                }
                continue;
            }
        }
    }

    // ---- Build final array; ensure 3 semesters per year scaffold
    const plan = Array.from(years.values())
        .sort((a, b) => a.year - b.year)
        .map(({ year, semesters }) => ({
            year,
            semesters: [1, 2, 3].map(s =>
                semesters.get(s) || { id: `y${year}-s${s}`, title: `Sem ${s} (${year})`, subjects: [] }
            )
        }));

    // Debug counts
    if (typeof window !== 'undefined' && window?.console) {
        const subCount = plan.reduce(
            (n, y) => n + y.semesters.reduce((m, s) => m + (s.subjects?.length || 0), 0),
            0
        );
        console.log('[DSL] years:', plan.map(y => y.year), 'subjects:', subCount, 'buckets:', Object.keys(Object.fromEntries(buckets.entries())).length);
    }

    return { plan, buckets: Object.fromEntries(buckets.entries()) };
}
