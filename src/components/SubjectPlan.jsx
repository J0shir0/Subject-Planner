import { useEffect, useRef, useState, useCallback } from "react";
import YearSection from "./YearSection.jsx";
import TopBar from "./TopBar.jsx";
import ElectivePanel from "./ElectivePanel.jsx";
import { fetchSchedule, fetchAttempts } from "../web/apiClient.js";

// ----------------- helpers -----------------

const getProgress = (plan) => {
    const all = (plan || [])
        .flatMap((y) => y.semesters)
        .flatMap((s) => s.subjects || []);
    const total = all.length || 0;
    const done = all.filter((sub) => sub.status === "Completed").length;
    return total ? (done / total) * 100 : 0;
};

function isPass(grade) {
    if (!grade) return false;
    const g = grade.toUpperCase().trim();
    return g !== "F" && g !== "F*";
}

function isFail(grade) {
    if (!grade) return false;
    const g = grade.toUpperCase().trim();
    return g === "F" || g === "F*";
}

/**
 * Turn API schedule [{year, sem, subjectCode, subjectName, reason}]
 * into the UI shape:
 * [{ year, semesters: [{ id, sem, subjects: [{...}] }] }]
 */
function scheduleToPlan(schedule, cohortYear, passedSet, failedSet) {
    const byYearSem = new Map(); // "2025-APR" -> [{code,name,status}, ...]

    for (const it of schedule || []) {
        const key = `${it.year}-${it.sem}`;
        if (!byYearSem.has(key)) byYearSem.set(key, []);

        const code = String(it.subjectCode || "").toUpperCase().trim();
        let status = "Planned";
        if (passedSet.has(code)) status = "Completed";
        else if (failedSet.has(code)) status = "Failed";

        byYearSem.get(key).push({
            code,
            name: it.subjectName || code,
            status,
        });
    }

    const yearsMap = new Map(); // yearNumber -> { year, semesters: [...] }
    const order = (s) => (s === "JAN" ? 0 : s === "APR" ? 1 : 2);

    for (const [key, list] of byYearSem.entries()) {
        const [yyyy, sem] = key.split("-");
        const calYear = Number(yyyy);
        const yearNumber = Math.max(1, (calYear - cohortYear) + 1);

        if (!yearsMap.has(yearNumber)) {
            yearsMap.set(yearNumber, { year: yearNumber, semesters: [] });
        }

        yearsMap.get(yearNumber).semesters.push({
            id: `${calYear}-${sem}`,
            sem,
            subjects: list.map((s, idx) => ({
                id: `${s.code}-${idx}`,
                type: "core",            // everything in computed schedule is a fixed subject
                slotKind: s.code.startsWith("MPU") ? "mpu" : undefined,
                code: s.code,
                name: s.name,
                credits: null,
                status: s.status,
            })),
        });
    }

    // sort semesters and years
    const years = Array.from(yearsMap.values()).map((y) => ({
        ...y,
        semesters: y.semesters.sort((a, b) => {
            const ay = Number(a.id.slice(0, 4));
            const by = Number(b.id.slice(0, 4));
            if (ay !== by) return ay - by;
            return order(a.sem) - order(b.sem);
        }),
    }));

    years.sort((a, b) => a.year - b.year);
    return years;
}

// ----------------- component -----------------

const SubjectPlan = ({ student, onLogout }) => {
    const [plan, setPlan] = useState([]);
    const [activeSlot, setActiveSlot] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [failed, setFailed] = useState([]); // for "repeat failed" button if you want later
    const bucketsRef = useRef({}); // still used by ElectivePanel for non-MPU electives (future)
    const progress = getProgress(plan);

    // load from backend API only
    const loadFromAPI = useCallback(async () => {
        setErr("");
        setLoading(true);
        try {
            // 1) get schedule + attempts from backend
            const [scheduleData, attemptsDataRaw] = await Promise.all([
                fetchSchedule(student.studentId),
                fetchAttempts(student.studentId).catch((_e) => []), // if attempts 500, continue with empty
            ]);

            const attemptsData = attemptsDataRaw || [];

            // 2) build pass/fail sets from attempts
            const passedSet = new Set(
                attemptsData
                    .filter((a) => isPass(a.grade))
                    .map((a) => String(a.subjectCode || "").toUpperCase().trim())
            );
            const failedSet = new Set(
                attemptsData
                    .filter((a) => isFail(a.grade))
                    .map((a) => String(a.subjectCode || "").toUpperCase().trim())
            );

            setFailed(
                attemptsData
                    .filter((a) => failedSet.has(String(a.subjectCode || "").toUpperCase().trim()))
                    .map((a) => ({
                        code: String(a.subjectCode || "").toUpperCase().trim(),
                        name: a.subjectName || a.subjectCode,
                    }))
            );

            // 3) derive cohortYear from backend response
            const cohortYear =
                Number(String(scheduleData.cohort || "").slice(0, 4)) ||
                new Date().getFullYear();

            // 4) convert to UI structure
            const uiPlan = scheduleToPlan(
                scheduleData.schedule || [],
                cohortYear,
                passedSet,
                failedSet
            );

            setPlan(uiPlan);
        } catch (e) {
            console.error("[SubjectPlan] loadFromAPI error:", e);
            setErr(e.message || "Failed to load schedule from server");
            setPlan([]);
        } finally {
            setLoading(false);
        }
    }, [student?.studentId]);

    // initial load
    useEffect(() => {
        loadFromAPI();
    }, [loadFromAPI]);

    // top-bar Reset → re-fetch from backend
    const handleReset = () => {
        loadFromAPI();
    };

    // subject status changes still work on the client-side plan
    const handleChangeStatus = (semesterId, subjectId, nextStatus) => {
        setPlan((prev) =>
            prev.map((y) => ({
                ...y,
                semesters: y.semesters.map((s) => {
                    if (s.id !== semesterId) return s;
                    return {
                        ...s,
                        subjects: s.subjects.map((sub) =>
                            sub.id === subjectId ? { ...sub, status: nextStatus } : sub
                        ),
                    };
                }),
            }))
        );
    };

    // optional elective logic (still there for discipline/free electives later)
    const handleClearElective = (semesterId, subjectId) => {
        setPlan((prev) =>
            prev.map((y) => ({
                ...y,
                semesters: y.semesters.map((s) => {
                    if (s.id !== semesterId) return s;
                    return {
                        ...s,
                        subjects: s.subjects.map((sub) => {
                            if (sub.id !== subjectId || sub.type !== "elective") return sub;
                            const kind = sub.slotKind;
                            const kindName =
                                kind === "discipline"
                                    ? "Discipline Elective (TBD)"
                                    : kind === "free"
                                        ? "Free Elective (TBD)"
                                        : kind === "mpu"
                                            ? "MPU (Fixed)"
                                            : "Elective (TBD)";
                            return {
                                ...sub,
                                code: "ELECTIVE",
                                name: kindName,
                                credits: null,
                            };
                        }),
                    };
                }),
            }))
        );
    };

    const openElective = ({ slotId, bucketId }) => {
        const options = bucketsRef.current[bucketId] || [];
        setActiveSlot({ slotId, bucketId, options });
    };
    const closeElective = () => setActiveSlot(null);

    const applyElectiveChoice = ({ slotId, subjectId, title, credits }) => {
        setPlan((prev) =>
            prev.map((y) => ({
                ...y,
                semesters: y.semesters.map((s) => ({
                    ...s,
                    subjects: s.subjects.map((sub) => {
                        if (sub.type === "elective" && sub.id === slotId) {
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
            }))
        );
        closeElective();
    };

    // ----------------- render -----------------

    return (
        <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#eee" }}>
            <TopBar
                progress={progress}
                student={student}
                onLogout={onLogout}
                onReset={handleReset}
            />

            {/* Optional repeat-failed button */}
            <div style={{ padding: "0 16px 8px" }}>
                {failed.length > 0 && (
                    <button onClick={() => {}}>
                        Repeat failed subjects ({failed.length})
                    </button>
                )}
            </div>

            <div style={{ padding: 16 }}>
                {loading && <div>Loading plan…</div>}
                {err && (
                    <div style={{ color: "salmon", marginBottom: 8 }}>
                        {err}
                    </div>
                )}

                {plan.length === 0 && !loading && !err && (
                    <div style={{ opacity: 0.8 }}>
                        No plan loaded from server for this student yet.
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
