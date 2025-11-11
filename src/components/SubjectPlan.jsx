import { useEffect, useRef, useState, useCallback } from 'react';
import YearSection from './YearSection.jsx';
import TopBar from './TopBar.jsx';
import ElectivePanel from './ElectivePanel.jsx';
import { parseSubjectPlanDSL } from './parseSubjectPlanDSL.js';

// progress helper
const getProgress = (plan) => {
    const all = (plan || []).flatMap(y => y.semesters).flatMap(s => s.subjects || []);
    const total = all.length || 0;
    const done = all.filter(sub => sub.status === 'Completed').length;
    return total ? (done / total) * 100 : 0;
};

const SubjectPlan = ({ student, planPath = "plans/2024-01.dsl", onLogout }) => {
    // --- State and Refs for Plan & UI ---
    const [plan, setPlan] = useState([]);               // plan comes from DSL
    const [activeSlot, setActiveSlot] = useState(null); // { slotId, bucketId, options? }
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [repeatOpen, setRepeatOpen] = useState(false);
    const bucketsRef = useRef({});                      // bucketId -> options[]
    const progress = getProgress(plan);

    // --- Failed subjects state (mock for now) ---
    const [failed, setFailed] = useState([]); // [{code, name, credits}, ...]
    const loadFailed = useCallback(async () => {
        try {
            setFailed([
                // { code: "CSC2103", name: "Data Structure & Algorithms", credits: 4 },
            ]);
        } catch {
            setFailed([]);
        }
    }, [student?.studentId]);
    useEffect(() => { loadFailed(); }, [loadFailed]);

    // --- load from DSL (using planPath) ---
    const loadFromDSL = useCallback(async () => {
        setErr(''); setLoading(true);
        try {
            // Import all DSLs in src/plans as raw strings
            const allPlans = import.meta.glob('/src/plans/*.dsl', {
                query: '?raw',
                import: 'default',
                eager: true,
            });

            // Build candidate filenames from the planPath’s last segment
            const base = (planPath.split('/').pop() || '').trim();
            const candidates = [
                base,
                base.replace(/-/g, '_'),
                base.replace(/_/g, '-'),
            ].filter((v, i, a) => v && a.indexOf(v) === i); // unique & non-empty

            // Find the first that exists
            let text = null, chosenKey = null;
            for (const name of candidates) {
                const key = `/src/plans/${name}`;
                if (allPlans[key]) { text = allPlans[key]; chosenKey = key; break; }
            }

            if (!text) {
                console.warn('Available DSL keys:', Object.keys(allPlans));
                throw new Error(`Cohort file not found for ${base}. Tried: ${candidates.join(', ')}`);
            }

            const { plan: parsedPlan, buckets } = parseSubjectPlanDSL(text.replace(/^\uFEFF/, ''));
            bucketsRef.current = buckets;
            setPlan(parsedPlan);

            if (!parsedPlan?.length) {
                console.warn('[Planner] Parsed 0 semesters from', chosenKey, 'First 3 lines:\n',
                    text.split(/\r?\n/).slice(0,3).join('\n'));
            }
        } catch (e) {
            console.error('[Planner] loadFromDSL error:', e);
            setErr(e.message || 'DSL parse failed');
            setPlan([]);
        } finally {
            setLoading(false);
        }
    }, [planPath]);

    useEffect(() => { loadFromDSL(); }, [loadFromDSL]);

    // --- top bar actions ---
    const handleReset = () => loadFromDSL();

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
            <div style={{ padding: "0 16px 8px" }}>
                {failed.length > 0 && (
                    <button onClick={() => setRepeatOpen(true)}>
                        Repeat failed subjects ({failed.length})
                    </button>
                )}
            </div>

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
