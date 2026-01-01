import { useEffect, useRef, useState, useCallback } from 'react';
import YearSection from './YearSection.jsx';
import TopBar from './TopBar.jsx';
import ElectivePanel from './ElectivePanel.jsx';
import { parseSubjectPlanDSL } from './parseSubjectPlanDSL.js';
import { fetchAttempts } from '../web/apiClient.js';

// --- helpers ---------------------------------------------------------

const getProgress = (plan) => {
    const all = (plan || []).flatMap(y => y.semesters).flatMap(s => s.subjects || []);
    const total = all.length || 0;
    const done = all.filter(sub => sub.status === 'Completed').length;
    return total ? (done / total) * 100 : 0;
};

function isPass(grade) {
    if (!grade) return false;
    const g = grade.toUpperCase().trim();
    return g !== 'F' && g !== 'F*';
}

function isFail(grade) {
    if (!grade) return false;
    const g = grade.toUpperCase().trim();
    return g === 'F' || g === 'F*';
}

// overlay pass / fail into a DSL plan
function applyAttemptsToPlan(dslPlan, attempts) {
    if (!attempts || attempts.length === 0) return dslPlan;

    // 1. Group attempts by their Clean Subject Code
    const attemptsBySubject = new Map();

    attempts.forEach(a => {
        // Clean Code: "BIS2212(MU32422)" -> "BIS2212"
        const cleanCode = normalizeCode(a.subjectCode);

        if (!attemptsBySubject.has(cleanCode)) {
            attemptsBySubject.set(cleanCode, []);
        }
        attemptsBySubject.get(cleanCode).push(a);
    });

    // 2. Determine Final Status for each subject based on the LATEST attempt
    const finalStatusMap = new Map(); // Key: CleanCode -> "Completed" | "Failed"

    attemptsBySubject.forEach((list, code) => {
        // Sort attempts: Early Year -> Late Year -> Normal Status -> Resit Status
        list.sort((a, b) => {
            // Sort by Year
            const yA = Number(a.examYear || 0);
            const yB = Number(b.examYear || 0);
            if (yA !== yB) return yA - yB;

            // Sort by Month
            const mA = Number(a.examMonth || 0);
            const mB = Number(b.examMonth || 0);
            if (mA !== mB) return mA - mB;

            // Sort by Status Priority (Empty < RS < RP)
            // We want Resits (RS) to come AFTER the main exam of the same month
            const getWeight = (s) => {
                const stat = String(s || '').toUpperCase();
                if (stat.includes('RP')) return 3; // Retake/Repeat (Later)
                if (stat.includes('RS')) return 2; // Resit (Later)
                return 1; // Normal/Empty (First)
            };
            return getWeight(a.status) - getWeight(b.status);
        });

        // TAKE THE LAST ONE (The Latest Attempt)
        const latest = list[list.length - 1];

        // Clean the Grade: Removes "F*", "^" symbol, spaces
        // "A-^" becomes "A-", "F*" becomes "F"
        const rawGrade = String(latest.grade || '').toUpperCase();
        const cleanGrade = rawGrade.replace(/[^A-Z0-9+\-]/g, '').trim();

        const passingGrades = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "P", "EX"];

        if (passingGrades.includes(cleanGrade)) {
            finalStatusMap.set(code, 'Completed');
        } else if (cleanGrade === 'F') {
            finalStatusMap.set(code, 'Failed');
        }
        // If it's something else (like "Absent"), we leave it as default/Planned
    });

    // 3. Apply to Plan
    return (dslPlan || []).map(y => ({
        ...y,
        semesters: y.semesters.map(s => ({
            ...s,
            subjects: (s.subjects || []).map(sub => {
                const planCode = normalizeCode(sub.code);

                let newStatus = sub.status || 'Planned';
                if (finalStatusMap.has(planCode)) {
                    newStatus = finalStatusMap.get(planCode);
                }

                return { ...sub, status: newStatus };
            }),
        })),
    }));
}

// add extra passed subjects that are not in the DSL plan
// add extra passed subjects that are not in the DSL plan
// add extra passed subjects that are not in the DSL plan

const normalizeCode = (code) =>
    String(code || "")
        .toUpperCase()
        .split('(')[0] // <--- Removes the (MU32422) part
        .replace(/\s+/g, "")
        .trim();

const normalizeTitle = (title) =>
    String(title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .trim();


// add extra passed BKA-type MPUs that are not in the DSL plan
function augmentWithExtraPassedMPUs(plan, attempts) {
    if (!plan || !attempts) return plan;

    // helper: map exam month to canonical semester month (01, 04, 09)
    function mapExamToPlanYm(year, rawMonth) {
        const m = Number(rawMonth);
        if (!year || !m) return null;

        let semYear = year;
        let semMonth;

        if (m === 1) {
            // January Exam = September Semester of Previous Year
            semMonth = 9;
            semYear = year - 1;
        } else if (m === 2 || m === 3) {
            semMonth = 1;            // Jan semester (Current Year)
        } else if (m >= 4 && m <= 8) {
            semMonth = 4;            // Apr semester (Current Year)
        } else {
            semMonth = 9;            // Sep semester (Current Year)
        }

        const mm = String(semMonth).padStart(2, "0");
        return `${semYear}-${mm}`;      // e.g. Exam 2025-01 -> Returns "2024-09"
    }


    // 1) collect all codes that already exist in the DSL plan
    const inPlan = new Set(
        plan
            .flatMap((y) => y.semesters)
            .flatMap((s) => s.subjects || [])
            .map((sub) => normalizeCode(sub.code))
    );

    // 2) find extra passed BKA attempts NOT already in the plan
    const extras = (attempts || []).filter((a) => {
        const codeNorm = normalizeCode(a.subjectCode);
        if (!codeNorm) return false;

        // special BKA codes: new (MPU3232) and old (MU22113)
        const isBka =
            codeNorm === "MPU3232" ||
            codeNorm === "MU22113";

        if (!isBka) return false;
        if (!isPass(a.grade)) return false;         // only passed
        if (inPlan.has(codeNorm)) return false;     // already in DSL
        return true;
    });

    if (extras.length === 0) return plan;

    // 3) shallow-copy plan so we don't mutate original
    const next = plan.map((y) => ({
        ...y,
        semesters: y.semesters.map((s) => ({
            ...s,
            subjects: [...(s.subjects || [])],
        })),
    }));

    // 4) place each extra BKA into the correct semester
    for (const a of extras) {
        const codeNorm = normalizeCode(a.subjectCode);
        const title = a.subjectName || "Bahasa Kebangsaan A";

        const year = Number(a.examYear ?? a.examyear);
        const month = Number(a.examMonth ?? a.exammonth);
        if (!year || !month) continue;

        const ymCanonical = mapExamToPlanYm(year, month); // e.g. "2023-01"

        let yearEntry = null;
        let sem = null;

        if (ymCanonical) {
            yearEntry = next.find((y) =>
                y.semesters.some(
                    (s) =>
                        typeof s.title === "string" &&
                        s.title.includes(`(${ymCanonical})`)
                )
            );
            if (yearEntry) {
                sem = yearEntry.semesters.find(
                    (s) =>
                        typeof s.title === "string" &&
                        s.title.includes(`(${ymCanonical})`)
                );
            }
        }

        // fallback: match by year only
        if (!yearEntry) {
            yearEntry = next.find((y) => String(y.year) === String(year));
        }
        if (!yearEntry) continue;

        if (!sem) {
            const titleYm = ymCanonical || `${year}`;
            sem = {
                id: `extra-${titleYm}`,
                title: `Extra subjects (${titleYm})`,
                subjects: [],
            };
            yearEntry.semesters.push(sem);
        }

        // avoid double-inserting if already added
        const alreadyThere = sem.subjects.some(
            (sub) => normalizeCode(sub.code) === codeNorm
        );
        if (alreadyThere) continue;

        sem.subjects.push({
            id: codeNorm,
            code: codeNorm,
            name: title,
            credits: null,
            status: "Completed",
            type: "mpu",     // shows as MPU in card
        });
    }

    return next;
}

function autoFillElectivesFromAttempts(plan, attempts, bucketsObj) {
    if (!plan || !attempts || !bucketsObj) return plan;

    // All passed attempts (normalised)
    const passedAttempts = (attempts || [])
        .filter(a => isPass(a.grade))
        .map((a, index) => ({
            index,
            codeNorm: normalizeCode(a.subjectCode),
            titleNorm: normalizeTitle(a.subjectName),
            raw: a,
        }));

    if (!passedAttempts.length) return plan;

    // Bucket options with normalised code + title
    const bucketOptions = {};
    Object.entries(bucketsObj).forEach(([bucketId, opts]) => {
        bucketOptions[bucketId] = (opts || []).map(opt => ({
            ...opt,
            codeNorm: normalizeCode(opt.subjectId),
            titleNorm: normalizeTitle(opt.title),
        }));
    });

    const usedAttemptIdx = new Set();

    const next = plan.map(y => ({
        ...y,
        semesters: y.semesters.map(s => ({
            ...s,
            subjects: (s.subjects || []).map(sub => {
                if (sub.type !== 'elective') return sub;

                const isEmpty =
                    sub.code === 'ELECTIVE' ||
                    /TBD/i.test(sub.name || '');

                if (!isEmpty) return sub;

                const options = bucketOptions[sub.bucketId] || [];
                if (!options.length) return sub;

                let matchOpt = null;
                let matchAttemptIdx = null;

                // Find a passed attempt that matches by code OR by title
                for (const opt of options) {
                    const attempt = passedAttempts.find(a =>
                        !usedAttemptIdx.has(a.index) &&
                        (
                            a.codeNorm === opt.codeNorm ||
                            (opt.titleNorm && a.titleNorm === opt.titleNorm)
                        )
                    );
                    if (attempt) {
                        matchOpt = opt;
                        matchAttemptIdx = attempt.index;
                        break;
                    }
                }

                if (!matchOpt) return sub;

                usedAttemptIdx.add(matchAttemptIdx);

                return {
                    ...sub,
                    code: matchOpt.subjectId,
                    name: matchOpt.title,
                    credits: matchOpt.credits ?? sub.credits,
                    status: 'Completed',
                };
            }),
        })),
    }));

    return next;
}



// merge elective choices / statuses from a saved plan into a fresh base / Preserves choices, fixes structure
function mergeSavedPlan(basePlan, savedRaw) {
    const savedPlan = Array.isArray(savedRaw)
        ? savedRaw
        : (savedRaw && Array.isArray(savedRaw.plan) ? savedRaw.plan : null);

    if (!savedPlan) return basePlan;

    // Index the saved data for quick lookup
    const index = new Map();
    for (const y of savedPlan) {
        for (const s of y.semesters || []) {
            for (const sub of s.subjects || []) {
                const key = `${y.year}|${s.id}|${sub.id}`;
                index.set(key, sub);
            }
        }
    }

    return basePlan.map(y => ({
        ...y,
        semesters: y.semesters.map(s => ({
            ...s,
            subjects: (s.subjects || []).map(sub => {
                const key = `${y.year}|${s.id}|${sub.id}`;
                const saved = index.get(key);

                // If no save data exists for this subject ID, keep the new DSL version
                if (!saved) return sub;

                // --- SMART RULE 1: STRUCTURAL INTEGRITY ---
                // If the new DSL says this is a CORE subject (not an elective slot),
                // we strictly forbid the Save File from changing its Code or Name.
                // We ONLY allow the 'status' (Planned/Completed) to be imported.
                if (sub.type !== 'elective') {
                    // Check if the server says it's completed (Green)
                    const serverSaysCompleted = sub.status === 'Completed';
                    const savedSaysCompleted = saved.status === 'Completed';

                    return {
                        ...sub, // Keep the DSL's code, name, credits, and type!
                        // Only use saved status if the server doesn't already say "Completed"
                        status: serverSaysCompleted ? 'Completed' : (saved.status || sub.status)
                    };
                }

                // --- SMART RULE 2: ELECTIVE SLOTS ---
                // For elective slots, we WANT the saved data (user choices)

                // ...but don't let an empty saved slot overwrite a pre-filled one
                const savedIsEmpty =
                    saved.type === 'elective' &&
                    (saved.code === 'ELECTIVE' || /TBD/i.test(saved.name || ''));

                const baseIsFilled =
                    sub.type === 'elective' &&
                    sub.status === 'Completed' &&
                    sub.code &&
                    sub.code !== 'ELECTIVE';

                if (savedIsEmpty && baseIsFilled) {
                    return sub;
                }

                // If it's a valid elective choice, keep it!
                return {
                    ...sub,
                    code: saved.code ?? sub.code,
                    name: saved.name ?? sub.name,
                    status: saved.status ?? sub.status,
                    credits: saved.credits ?? sub.credits,
                };
            }),
        })),
    }));
}


// --- component -------------------------------------------------------

const SubjectPlan = ({ student, planPath = 'plans/2024-01.dsl', onLogout }) => {
    const [plan, setPlan] = useState([]);               // DSL + statuses (+ electives)
    const [activeSlot, setActiveSlot] = useState(null); // { slotId, bucketId, options? }
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [attemptErr, setAttemptErr] = useState('');
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'dark';
        const saved = window.localStorage.getItem('planner_theme');
        return saved === 'light' ? 'light' : 'dark';
    });
    // const [dupWarning, setDupWarning] = useState('');
    const bucketsRef = useRef({});                      // bucketId -> options[]

    const progress = getProgress(plan);

    // key for localStorage so we remember electives per student+cohort
    const storageKey =
        student?.studentId && student?.cohort
            ? `planner_plan_v2_${student.studentId}_${student.cohort}`
            : null;

    // load DSL + attempts and merge them
    const loadPlanWithStatus = useCallback(async () => {
        setErr('');
        setAttemptErr('');
        // setDupWarning('');
        setLoading(true);

        try {
            // 1) load DSL for this cohort
            const allPlans = import.meta.glob('/src/plans/*.dsl', {
                query: '?raw',
                import: 'default',
                eager: true,
            });

            const base = (planPath.split('/').pop() || '').trim(); // e.g. "2024-01.dsl"
            const candidates = [
                base,
                base.replace(/-/g, '_'),
                base.replace(/_/g, '-'),
            ].filter((v, i, a) => v && a.indexOf(v) === i);

            let text = null;
            for (const name of candidates) {
                const key = `/src/plans/${name}`;
                if (allPlans[key]) {
                    text = allPlans[key];
                    break;
                }
            }

            if (!text) {
                throw new Error(`Cohort file not found for ${base}`);
            }

            const { plan: parsedPlan, buckets } =
                parseSubjectPlanDSL(text.replace(/^\uFEFF/, ''));

            bucketsRef.current = buckets;

            // 2) fetch attempts for this student and overlay
            let attempts = [];
            try {
                if (student?.studentId) {
                    attempts = await fetchAttempts(student.studentId);
                }
            } catch (e) {
                console.warn('[Planner] Attempts fetch failed:', e);
                setAttemptErr(`Attempts fetch failed: ${e.message || e}`);
            }

            // overlay attempts + extra MPUs
            const merged = applyAttemptsToPlan(parsedPlan, attempts);
            const mergedBase = augmentWithExtraPassedMPUs(merged, attempts);

            // autofill elective slots from passed attempts (for older cohorts)
            const prefilled = autoFillElectivesFromAttempts(
                mergedBase,
                attempts,
                buckets
            );

            // apply any saved electives / manual statuses from localStorage
            let finalPlan = prefilled;
            if (storageKey) {
                try {
                    const raw = localStorage.getItem(storageKey);
                    if (raw) {
                        const saved = JSON.parse(raw);
                        finalPlan = mergeSavedPlan(prefilled, saved);
                    }
                } catch (e) {
                    console.warn('[Planner] Failed to read saved plan', e);
                }
            }

            setPlan(finalPlan);

        } catch (e) {
            console.error('[Planner] load plan failed:', e);
            setErr(e.message || 'Plan load failed');
            setPlan([]);
        } finally {
            setLoading(false);
        }
    }, [planPath, student?.studentId, storageKey]);

    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.body.classList.remove('theme-dark', 'theme-light');
            document.body.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');
        }
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('planner_theme', theme);
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    useEffect(() => {
        loadPlanWithStatus();
    }, [loadPlanWithStatus]);

    // persist plan whenever it changes
    useEffect(() => {
        if (!storageKey || !plan || !plan.length) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(plan));
        } catch (e) {
            console.warn('[Planner] Failed to save plan', e);
        }
    }, [plan, storageKey]);

    // --- subject mutations (manual tweaking still works) --------------

    const handleChangeStatus = (semesterId, subjectId, nextStatus) => {
        setPlan(prev => prev.map(y => ({
            ...y,
            semesters: y.semesters.map(s => {
                if (s.id !== semesterId) return s;
                return {
                    ...s,
                    subjects: s.subjects.map(sub =>
                        sub.id === subjectId ? { ...sub, status: nextStatus } : sub
                    ),
                };
            }),
        })));
    };

    const handleClearElective = (semesterId, subjectId) => {
        setPlan(prev => prev.map(y => ({
            ...y,
            semesters: y.semesters.map(s => {
                if (s.id !== semesterId) return s;
                return {
                    ...s,
                    subjects: s.subjects.map(sub => {
                        if (sub.id !== subjectId || sub.type !== 'elective') return sub;
                        const kind = sub.slotKind;
                        const kindName =
                            kind === 'discipline' ? 'Discipline Elective (TBD)' :
                                kind === 'free'       ? 'Free Elective (TBD)' :
                                    kind === 'mpu'        ? 'MPU (TBD)' :
                                        'Elective (TBD)';
                        return { ...sub, code: 'ELECTIVE', name: kindName, credits: null };
                    }),
                };
            }),
        })));
    };

    // --- elective panel wiring ---------------------------------------

    const openElective = ({ slotId, bucketId }) => {
        // Original options from the DSL bucket
        const allOptions = bucketsRef.current[bucketId] || [];

        // Find the semester that contains this slot
        let semesterWithSlot = null;
        for (const y of plan) {
            for (const s of y.semesters || []) {
                if (s.subjects?.some(sub => sub.id === slotId)) {
                    semesterWithSlot = s;
                    break;
                }
            }
            if (semesterWithSlot) break;
        }

        // If we somehow don't find the semester, just show all options
        if (!semesterWithSlot) {
            setActiveSlot({ slotId, bucketId, options: allOptions });
            return;
        }

        // Collect codes already used in this semester for this bucket
        const usedCodes = new Set(
            (semesterWithSlot.subjects || [])
                .filter(sub =>
                    sub.type === 'elective' &&
                    sub.bucketId === bucketId &&
                    sub.id !== slotId &&
                    sub.code &&
                    sub.code !== 'ELECTIVE'
                )
                .map(sub => String(sub.code).toUpperCase().trim())
        );

        // Filter out already-used electives from the list
        const filteredOptions = allOptions.filter(opt => {
            const c = String(opt.subjectId || '').toUpperCase().trim();
            return !usedCodes.has(c);
        });

        if (filteredOptions.length === 0) {
            if (typeof window !== 'undefined') {
                window.alert('All electives from this bucket are already used in this semester.');
            }
            return;
        }

        setActiveSlot({ slotId, bucketId, options: filteredOptions });
    };

    const closeElective = () => setActiveSlot(null);

    const applyElectiveChoice = ({ slotId, subjectId, title, credits }) => {
        let hadDuplicate = false;

        setPlan(prev =>
            prev.map(y => ({
                ...y,
                semesters: y.semesters.map(s => {
                    const hasSlot = s.subjects.some(sub => sub.id === slotId);
                    if (!hasSlot) return s;

                    const codeUpper = String(subjectId || '').toUpperCase().trim();

                    // Safety check: if something weird happened and we still have a duplicate
                    const alreadyUsed = s.subjects.some(sub =>
                        sub.id !== slotId &&
                        sub.type === 'elective' &&
                        String(sub.code || '').toUpperCase().trim() === codeUpper
                    );

                    if (alreadyUsed) {
                        hadDuplicate = true;
                        return s; // leave semester unchanged
                    }

                    return {
                        ...s,
                        subjects: s.subjects.map(sub =>
                            sub.type === 'elective' && sub.id === slotId
                                ? {
                                    ...sub,
                                    code: subjectId,
                                    name: title,
                                    credits: credits ?? sub.credits,
                                }
                                : sub
                        ),
                    };
                }),
            }))
        );

        if (hadDuplicate) {
            if (typeof window !== 'undefined') {
                window.alert(
                    `You have already selected ${subjectId} in this semester. Please pick a different elective.`
                );
            }
            // keep panel open
        } else {
            closeElective();
        }
    };

    // --- render -------------------------------------------------------

    return (
        <div className="app-shell" style={{minHeight: '100vh'}}>
            <TopBar
                progress={progress}
                student={student}
                onLogout={onLogout}
                theme={theme}
                onToggleTheme={toggleTheme}
                // onReset intentionally omitted: choices are persistent now
            />

            <div style={{padding: 16}}>

                {/*{dupWarning && (*/}
                {/*    <div*/}
                {/*        style={{*/}
                {/*            color: '#ffb3b3',*/}
                {/*            background: '#401010',*/}
                {/*            border: '1px solid #702020',*/}
                {/*            borderRadius: 6,*/}
                {/*            padding: '6px 10px',*/}
                {/*            marginBottom: 8,*/}
                {/*            display: 'flex',*/}
                {/*            justifyContent: 'space-between',*/}
                {/*            alignItems: 'center',*/}
                {/*            fontSize: 13,*/}
                {/*        }}*/}
                {/*    >*/}
                {/*        <span>{dupWarning}</span>*/}
                {/*        <button*/}
                {/*            onClick={() => setDupWarning('')}*/}
                {/*            style={{*/}
                {/*                marginLeft: 8,*/}
                {/*                border: 'none',*/}
                {/*                background: 'transparent',*/}
                {/*                color: '#ffb3b3',*/}
                {/*                cursor: 'pointer',*/}
                {/*                fontSize: 14,*/}
                {/*            }}*/}
                {/*            aria-label="Dismiss duplicate warning"*/}
                {/*        >*/}
                {/*            ×*/}
                {/*        </button>*/}
                {/*    </div>*/}
                {/*)}*/}

                {loading && <div>Loading plan…</div>}
                {err && <div style={{color: 'salmon', marginBottom: 8}}>{err}</div>}
                {attemptErr && (
                    <div style={{color: 'salmon', marginBottom: 8}}>{attemptErr}</div>
                )}

                {plan.length === 0 && !loading && !err && (
                    <div style={{opacity: 0.8}}>
                        No plan loaded. Check cohort file: <code>{planPath}</code>
                    </div>
                )}

                {plan.map(({year, semesters}) => (
                    <YearSection
                        key={year}
                        year={year}
                        semesters={semesters}
                        onOpenElective={openElective}
                        onChangeStatus={handleChangeStatus}
                        onClearElective={handleClearElective}
                        onDropElective={applyElectiveChoice}
                    />
                ))}
            </div>

            {activeSlot && (
                <ElectivePanel
                    slot={activeSlot}
                    onClose={closeElective}
                    onChoose={applyElectiveChoice}
                    thrmr={theme}
                />
            )}
        </div>
    );
};

export default SubjectPlan;
