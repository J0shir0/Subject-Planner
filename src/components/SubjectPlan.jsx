import { useEffect, useRef, useState, useCallback } from 'react';
import YearSection from './YearSection.jsx';
import TopBar from './TopBar.jsx';
import ElectivePanel from './ElectivePanel.jsx';
import { parseSubjectPlanDSL } from './parseSubjectPlanDSL.js';
import { fetchAttempts } from '../web/apiClient.js';


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

// --- SAFE SORT HELPER ---
const getSemesterDateValue = (semObj) => {
    const nameStr = semObj.name || semObj.title || "";
    const match = nameStr.match(/\((\d{4})-(\d{2})\)/);
    if (match) {
        return parseInt(match[1]) * 100 + parseInt(match[2]);
    }
    return 999999;
};

// overlay pass / fail into a DSL plan
function applyAttemptsToPlan(dslPlan, attempts) {
    if (!attempts || attempts.length === 0) return dslPlan;

    const attemptsBySubject = new Map();
    attempts.forEach(a => {
        const cleanCode = normalizeCode(a.subjectCode);
        if (!attemptsBySubject.has(cleanCode)) {
            attemptsBySubject.set(cleanCode, []);
        }
        attemptsBySubject.get(cleanCode).push(a);
    });

    const finalStatusMap = new Map();
    attemptsBySubject.forEach((list, code) => {
        list.sort((a, b) => {
            const yA = Number(a.examYear || 0);
            const yB = Number(b.examYear || 0);
            if (yA !== yB) return yA - yB;
            const mA = Number(a.examMonth || 0);
            const mB = Number(b.examMonth || 0);
            if (mA !== mB) return mA - mB;
            const getWeight = (s) => {
                const stat = String(s || '').toUpperCase();
                if (stat.includes('RP')) return 3;
                if (stat.includes('RS')) return 2;
                return 1;
            };
            return getWeight(a.status) - getWeight(b.status);
        });

        const latest = list[list.length - 1];
        const rawGrade = String(latest.grade || '').toUpperCase();
        const cleanGrade = rawGrade.replace(/[^A-Z0-9+\-]/g, '').trim();
        const passingGrades = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "P", "EX"];

        if (passingGrades.includes(cleanGrade)) {
            finalStatusMap.set(code, 'Completed');
        } else if (cleanGrade === 'F') {
            finalStatusMap.set(code, 'Failed');
        }
    });

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

const normalizeCode = (code) =>
    String(code || "")
        .toUpperCase()
        .split('(')[0]
        .replace(/\s+/g, "")
        .trim();

const normalizeTitle = (title) =>
    String(title || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .trim();

function augmentWithExtraPassedMPUs(plan, attempts) {
    if (!plan || !attempts) return plan;

    function mapExamToPlanYm(year, rawMonth) {
        const m = Number(rawMonth);
        if (!year || !m) return null;
        let semYear = year;
        let semMonth;
        if (m === 1) {
            semMonth = 9;
            semYear = year - 1;
        } else if (m === 2 || m === 3) {
            semMonth = 1;
        } else if (m >= 4 && m <= 8) {
            semMonth = 4;
        } else {
            semMonth = 9;
        }
        const mm = String(semMonth).padStart(2, "0");
        return `${semYear}-${mm}`;
    }

    const inPlan = new Set(
        plan.flatMap((y) => y.semesters)
            .flatMap((s) => s.subjects || [])
            .map((sub) => normalizeCode(sub.code))
    );

    const extras = (attempts || []).filter((a) => {
        const codeNorm = normalizeCode(a.subjectCode);
        if (!codeNorm) return false;
        const isBka = codeNorm === "MPU3232" || codeNorm === "MU22113";
        if (!isBka) return false;
        if (!isPass(a.grade)) return false;
        if (inPlan.has(codeNorm)) return false;
        return true;
    });

    if (extras.length === 0) return plan;

    const next = plan.map((y) => ({
        ...y,
        semesters: y.semesters.map((s) => ({
            ...s,
            subjects: [...(s.subjects || [])],
        })),
    }));

    for (const a of extras) {
        const codeNorm = normalizeCode(a.subjectCode);
        const title = a.subjectName || "Bahasa Kebangsaan A";
        const year = Number(a.examYear ?? a.examyear);
        const month = Number(a.examMonth ?? a.exammonth);
        if (!year || !month) continue;

        const ymCanonical = mapExamToPlanYm(year, month);
        let yearEntry = null;
        let sem = null;

        if (ymCanonical) {
            yearEntry = next.find((y) =>
                y.semesters.some((s) =>
                    (s.title || s.name || "").includes(`(${ymCanonical})`)
                )
            );
            if (yearEntry) {
                sem = yearEntry.semesters.find((s) =>
                    (s.title || s.name || "").includes(`(${ymCanonical})`)
                );
            }
        }

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
            type: "mpu",
        });
    }

    return next;
}

function autoFillElectivesFromAttempts(plan, attempts, bucketsObj) {
    if (!plan || !attempts || !bucketsObj) return plan;

    const passedAttempts = (attempts || [])
        .filter(a => isPass(a.grade))
        .map((a, index) => ({
            index,
            codeNorm: normalizeCode(a.subjectCode),
            titleNorm: normalizeTitle(a.subjectName),
            raw: a,
        }));

    if (!passedAttempts.length) return plan;

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
                const isEmpty = sub.code === 'ELECTIVE' || /TBD/i.test(sub.name || '');
                if (!isEmpty) return sub;

                const options = bucketOptions[sub.bucketId] || [];
                if (!options.length) return sub;

                let matchOpt = null;
                let matchAttemptIdx = null;

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

function mergeSavedPlan(basePlan, savedRaw) {
    const savedPlan = Array.isArray(savedRaw)
        ? savedRaw
        : (savedRaw && Array.isArray(savedRaw.plan) ? savedRaw.plan : null);

    if (!savedPlan) return basePlan;
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
                if (!saved) return sub;

                if (sub.type !== 'elective') {
                    const serverSaysCompleted = sub.status === 'Completed';
                    return {
                        ...sub,
                        status: serverSaysCompleted ? 'Completed' : (saved.status || sub.status)
                    };
                }

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
    const [plan, setPlan] = useState([]);
    const [activeSlot, setActiveSlot] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [attemptErr, setAttemptErr] = useState('');
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return 'dark';
        const saved = window.localStorage.getItem('planner_theme');
        return saved === 'light' ? 'light' : 'dark';
    });
    const bucketsRef = useRef({});

    const progress = getProgress(plan);
    const storageKey = student?.studentId && student?.cohort
        ? `planner_plan_v2_${student.studentId}_${student.cohort}`
        : null;

    const loadPlanWithStatus = useCallback(async () => {
        setErr('');
        setAttemptErr('');
        setLoading(true);

        try {
            const allPlans = import.meta.glob('/src/plans/*.dsl', {
                query: '?raw',
                import: 'default',
                eager: true,
            });

            const base = (planPath.split('/').pop() || '').trim();
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

            if (!text) throw new Error(`Cohort file not found for ${base}`);

            const { plan: parsedPlan, buckets } = parseSubjectPlanDSL(text.replace(/^\uFEFF/, ''));
            bucketsRef.current = buckets;

            let attempts = [];
            try {
                if (student?.studentId) {
                    attempts = await fetchAttempts(student.studentId);
                }
            } catch (e) {
                console.warn('[Planner] Attempts fetch failed:', e);
                setAttemptErr(`Attempts fetch failed: ${e.message || e}`);
            }

            const merged = applyAttemptsToPlan(parsedPlan, attempts);
            const mergedBase = augmentWithExtraPassedMPUs(merged, attempts);
            const prefilled = autoFillElectivesFromAttempts(mergedBase, attempts, buckets);

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

    useEffect(() => {
        if (!storageKey || !plan || !plan.length) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(plan));
        } catch (e) {
            console.warn('[Planner] Failed to save plan', e);
        }
    }, [plan, storageKey]);

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
                // IMPORTANT: Match by ID OR by Name (because we renamed the semesters in UI)
                if (s.id !== semesterId && s.name !== semesterId && s.title !== semesterId) return s;
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

    const openElective = ({ slotId, bucketId }) => {
        const allOptions = bucketsRef.current[bucketId] || [];
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

        if (!semesterWithSlot) {
            setActiveSlot({ slotId, bucketId, options: allOptions });
            return;
        }

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
        // --- 1. GLOBAL DUPLICATE CHECK ---
        const codeToCheck = String(subjectId || '').toUpperCase().trim();
        let isDuplicate = false;

        // Iterate over the current 'plan' state synchronously
        for (const y of plan) {
            for (const s of y.semesters || []) {
                for (const sub of s.subjects || []) {
                    // Skip the slot we are currently editing to avoid false positive on self
                    if (sub.id === slotId) continue;

                    const existingCode = String(sub.code || '').toUpperCase().trim();
                    if (existingCode === codeToCheck) {
                        isDuplicate = true;
                        break;
                    }
                }
                if (isDuplicate) break;
            }
            if (isDuplicate) break;
        }

        if (isDuplicate) {
            if (typeof window !== 'undefined') {
                window.alert(
                    `You have already selected ${title || subjectId} (${subjectId}) in another semester!`
                );
            }
            // Do not update state; keep the slot as TBD
            closeElective();
            return;
        }

        // --- 2. UPDATE STATE (If Valid) ---
        setPlan(prev =>
            prev.map(y => ({
                ...y,
                semesters: y.semesters.map(s => {
                    const hasSlot = s.subjects.some(sub => sub.id === slotId);
                    if (!hasSlot) return s;

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

        closeElective();
    };

    // --- RENDER LOGIC ---
    // GLOBAL COUNTER for sequential semesters (1, 2, 3, 4...)
    let globalSemCount = 1;

    return (
        <div className="app-shell" style={{minHeight: '100vh'}}>
            <TopBar
                progress={progress}
                student={student}
                onLogout={onLogout}
                theme={theme}
                onToggleTheme={toggleTheme}
            />

            <div style={{padding: 16}}>
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

                {plan.map(({year, semesters}) => {
                    // 1. FILTER: Only keep semesters that actually have subjects
                    const activeSemesters = semesters.filter(s =>
                        s.subjects && s.subjects.length > 0
                    );

                    // 2. SORT: Sort by the date inside the brackets (2025-01)
                    const sortedSemesters = activeSemesters.sort((a, b) => {
                        return getSemesterDateValue(a) - getSemesterDateValue(b);
                    });

                    // 3. HIDE EMPTY YEARS
                    if (sortedSemesters.length === 0) return null;

                    // 4. RENAME: Apply sequential numbering (Sem 1, Sem 2, Sem 3...)
                    // irrespective of what year it is.
                    const renamedSemesters = sortedSemesters.map(sem => {
                        const originalName = sem.name || sem.title || "";
                        // Extract date part like (2024-04)
                        const dateMatch = originalName.match(/\(\d{4}-\d{2}\)/);
                        const dateSuffix = dateMatch ? dateMatch[0] : "";

                        // New Title: "Sem X (YYYY-MM)"
                        const newTitle = `Sem ${globalSemCount} ${dateSuffix}`;

                        // Increment global counter
                        globalSemCount++;

                        return {
                            ...sem,
                            name: newTitle,   // Update name for UI
                            title: newTitle   // Update title just in case
                        };
                    });

                    return (
                        <YearSection
                            key={year}
                            year={year}
                            semesters={renamedSemesters} // Pass the RENAMED list
                            onOpenElective={openElective}
                            onChangeStatus={handleChangeStatus}
                            onClearElective={handleClearElective}
                            onDropElective={applyElectiveChoice}
                        />
                    );
                })}
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