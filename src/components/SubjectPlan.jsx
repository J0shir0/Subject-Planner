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

    return (dslPlan || []).map(y => ({
        ...y,
        semesters: y.semesters.map(s => ({
            ...s,
            subjects: (s.subjects || []).map(sub => {
                const code = String(sub.code || '').toUpperCase().trim();
                let status = sub.status || 'Planned';
                if (passedSet.has(code)) status = 'Completed';
                else if (failedSet.has(code)) status = 'Failed';
                return { ...sub, status };
            }),
        })),
    }));
}

// --- component -------------------------------------------------------

const SubjectPlan = ({ student, planPath = 'plans/2024-01.dsl', onLogout }) => {
    const [plan, setPlan] = useState([]);               // DSL + statuses
    const [activeSlot, setActiveSlot] = useState(null); // { slotId, bucketId, options? }
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [attemptErr, setAttemptErr] = useState('');
    const bucketsRef = useRef({});                      // bucketId -> options[]

    const progress = getProgress(plan);

    // load DSL + attempts and merge them
    const loadPlanWithStatus = useCallback(async () => {
        setErr('');
        setAttemptErr('');
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

            const merged = applyAttemptsToPlan(parsedPlan, attempts);
            setPlan(merged);
        } catch (e) {
            console.error('[Planner] load plan failed:', e);
            setErr(e.message || 'Plan load failed');
            setPlan([]);
        } finally {
            setLoading(false);
        }
    }, [planPath, student?.studentId]);

    useEffect(() => {
        loadPlanWithStatus();
    }, [loadPlanWithStatus]);

    const handleReset = () => {
        loadPlanWithStatus();
    };

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
                        return {
                            ...sub,
                            code: subjectId,
                            name: title,
                            credits: credits ?? sub.credits,
                        };
                    }
                    return sub;
                }),
            })),
        })));
        closeElective();
    };

    // --- render -------------------------------------------------------

    return (
        <div style={{ minHeight: '100vh', background: '#0b0b0b', color: '#eee' }}>
            <TopBar
                progress={progress}
                student={student}
                onLogout={onLogout}
                onReset={handleReset}
            />

            <div style={{ padding: 16 }}>
                {loading && <div>Loading plan…</div>}
                {err && <div style={{ color: 'salmon', marginBottom: 8 }}>{err}</div>}
                {attemptErr && (
                    <div style={{ color: 'salmon', marginBottom: 8 }}>{attemptErr}</div>
                )}

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
