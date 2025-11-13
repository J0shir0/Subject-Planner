import { useEffect, useRef, useState, useCallback } from 'react';
import YearSection from './YearSection.jsx';
import TopBar from './TopBar.jsx';
import ElectivePanel from './ElectivePanel.jsx';
import { parseSubjectPlanDSL } from './parseSubjectPlanDSL.js';
import { fetchSchedule, fetchAttempts } from '../web/apiClient.js';

// progress helper
const getProgress = (plan) => {
    const all = (plan || []).flatMap(y => y.semesters).flatMap(s => s.subjects || []);
    const total = all.length || 0;
    const done = all.filter(sub => sub.status === 'Completed').length;
    return total ? (done / total) * 100 : 0;
};

function isPass(grade) {
    if (!grade) return false;
    const g = grade.toUpperCase().trim();
    // treat anything not F/F* as pass; tweak if you have P/EX rules
    return g !== 'F' && g !== 'F*';
}
function isFail(grade) {
    if (!grade) return false;
    const g = grade.toUpperCase().trim();
    return g === 'F' || g === 'F*';
}

// Turn API schedule [{year, sem, subjectCode, subjectName, reason}] into your UI plan
function scheduleToPlan(schedule, cohortYear, passedSet, failedSet) {
    const byYearSem = new Map(); // "2025-APR" -> [{code,name,reason}, ...]

    for (const it of schedule) {
        const key = `${it.year}-${it.sem}`;
        if (!byYearSem.has(key)) byYearSem.set(key, []);
        byYearSem.get(key).push({
            code: String(it.subjectCode || '').toUpperCase().trim(),
            name: it.subjectName || it.subjectCode,
            reason: it.reason || 'LINEUP',
        });
    }

    const yearsMap = new Map(); // yearNumber -> { year, semesters: [...] }
    const order = s => (s === 'JAN' ? 0 : s === 'APR' ? 1 : 2);

    for (const [key, list] of byYearSem.entries()) {
        const [yyyy, sem] = key.split('-');
        const calYear = Number(yyyy);
        const yearNumber = Math.max(1, (calYear - cohortYear) + 1);

        if (!yearsMap.has(yearNumber)) {
            yearsMap.set(yearNumber, { year: yearNumber, semesters: [] });
        }

        yearsMap.get(yearNumber).semesters.push({
            id: `${calYear}-${sem}`,
            sem,
            subjects: list.map((s, idx) => {
                const code = s.code;
                const status =
                    passedSet.has(code) ? 'Completed' :
                        failedSet.has(code)  ? 'Failed'    :
                            'Planned';

                return {
                    id: `${code}-${idx}`,
                    type: 'core',      // <- ensures no chooser for MPUs
                    slotKind: undefined,
                    code,
                    name: s.name || code,
                    credits: null,
                    status,
                };
            }),
        });
    }

    const years = Array.from(yearsMap.values()).map(y => ({
        ...y,
        semesters: y.semesters.sort((a, b) =>
            Number(a.id.slice(0,4)) !== Number(b.id.slice(0,4))
                ? Number(a.id.slice(0,4)) - Number(b.id.slice(0,4))
                : order(a.sem) - order(b.sem)
        ),
    }));
    years.sort((a,b) => a.year - b.year);
    return years;
}

const SubjectPlan = ({ student, planPath = "plans/2024-01.dsl", onLogout }) => {
    // --- State and Refs for Plan & UI ---
    const [plan, setPlan] = useState([]);               // plan comes from DSL
    const [activeSlot, setActiveSlot] = useState(null); // { slotId, bucketId, options? }
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    // const [repeatOpen, setRepeatOpen] = useState(false);
    const bucketsRef = useRef({});                      // bucketId -> options[]
    const progress = getProgress(plan);

    // --- Failed subjects state (mock for now) ---
    // const [failed, setFailed] = useState([]); // [{code, name, credits}, ...]
    // const loadFailed = useCallback(async () => {
    //     try {
    //         setFailed([
    //             // { code: "CSC2103", name: "Data Structure & Algorithms", credits: 4 },
    //         ]);
    //     } catch {
    //         setFailed([]);
    //     }
    // }, [student?.studentId]);
    // useEffect(() => { loadFailed(); }, [loadFailed]);

    // --- load from DSL (using planPath) ---
    const loadFromAPI = useCallback(async () => {
        setErr(''); setLoading(true);
        try {
            const [data, attempts] = await Promise.all([
                fetchSchedule(student.studentId),
                fetchAttempts(student.studentId),
            ]);

            const cohortYear = Number((data.cohort || '').slice(0,4)) || new Date().getFullYear();

            const passedSet = new Set(
                (attempts || [])
                    .filter(a => isPass(a.grade))
                    .map(a => String(a.subjectCode || '').toUpperCase().trim())
            );
            const failedSet = new Set(
                (attempts || [])
                    .filter(a => isFail(a.grade))
                    .map(a => String(a.subjectCode || '').toUpperCase().trim())
            );

            const uiPlan = scheduleToPlan(data.schedule || [], cohortYear, passedSet, failedSet);
            setPlan(uiPlan);
        } catch (e) {
            setErr(e.message || 'Failed to load schedule');
            setPlan([]);
        } finally {
            setLoading(false);
        }
    }, [student?.studentId]);

    const loadFromDSL = useCallback(async () => {
        setErr(''); setLoading(true);
        try {
            const allPlans = import.meta.glob('/src/plans/*.dsl', { query: '?raw', import: 'default', eager: true });
            const base = (planPath.split('/').pop() || '').trim();
            const candidates = [base, base.replace(/-/g, '_'), base.replace(/_/g, '-')].filter((v,i,a)=>v && a.indexOf(v)===i);
            let text = null;
            for (const name of candidates) {
                const key = `/src/plans/${name}`;
                if (allPlans[key]) { text = allPlans[key]; break; }
            }
            if (!text) throw new Error(`Cohort file not found for ${base}`);

            const { plan: parsedPlan, buckets } = parseSubjectPlanDSL(text.replace(/^\uFEFF/, ''));
            bucketsRef.current = buckets;
            setPlan(parsedPlan);
        } catch (e) {
            setErr(e.message || 'DSL parse failed');
            setPlan([]);
        } finally {
            setLoading(false);
        }
    }, [planPath]);

    useEffect(() => {
        (async () => {
            try {
                await loadFromAPI();        // prefer server schedule
            } catch (e) {
                console.warn('[Planner] API failed, falling back to DSL:', e?.message || e);
                await loadFromDSL();        // fallback if API is down or route missing
            }
        })();
    }, [loadFromAPI, loadFromDSL]);

    // --- top bar actions ---
    const handleReset = () => {
        (async () => {
            try {
                await loadFromAPI();
            } catch {
                await loadFromDSL();
            }
        })();
    };

    // --- subject mutations (keep status change + elective clear) ---
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

    // revert chosen elective back to empty slot (kind-aware)
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
                                    kind === 'mpu'        ? 'MPU Elective (TBD)'   :
                                        'Elective (TBD)';
                        return { ...sub, code: 'ELECTIVE', name: kindName, credits: null };
                    }),
                };
            }),
        })));
    };

    // --- elective panel wiring ---
    const openElective = ({ slotId, bucketId }) => {
        const options = bucketsRef.current[bucketId] || [];
        setActiveSlot({ slotId, bucketId, options });
    };
    const closeElective = () => setActiveSlot(null);

    const applyElectiveChoice = ({ slotId, subjectId, title, credits }) => {
        setPlan(prev => prev.map(y => ({
            ...y,
            semesters: y.semesters.map(s => ({
                ...s,
                subjects: s.subjects.map(sub => {
                    if (sub.type === 'elective' && sub.id === slotId) {
                        return { ...sub, code: subjectId, name: title, credits: credits ?? sub.credits };
                    }
                    return sub;
                }),
            })),
        })));
        closeElective();
    };

    return (
        <div style={{ minHeight: '100vh', background: '#0b0b0b', color: '#eee' }}>
            <TopBar
                progress={progress}
                student={student}
                onLogout={onLogout}
                onReset={handleReset}
            />

            {/* Repeat failed subjects button (will wire full panel later) */}
            {/*<div style={{ padding: "0 16px 8px" }}>*/}
            {/*    {failed.length > 0 && (*/}
            {/*        <button onClick={() => setRepeatOpen(true)}>*/}
            {/*            Repeat failed subjects ({failed.length})*/}
            {/*        </button>*/}
            {/*    )}*/}
            {/*</div>*/}

            <div style={{ padding: 16 }}>
                {loading && <div>Loading plan…</div>}
                {err && <div style={{ color: 'salmon', marginBottom: 8 }}>{err}</div>}

                {plan.length === 0 && !loading && !err && (
                    <div style={{ opacity: 0.8 }}>
                        No plan loaded. Check cohort file: <code>{planPath}</code>
                    </div>
                )}

                {plan.map(({ year, semesters }) => (
                    <YearSection
                        key={year}
                        year={year}
                        semesters={semesters}
                        // onAddSubject={undefined}   // hidden in SemesterColumn when undefined
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
                />
            )}
        </div>
    );
};

export default SubjectPlan;
