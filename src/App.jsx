import { useEffect, useState } from "react";
import SubjectPlan from "./components/SubjectPlan.jsx";
import Login from "./components/Login.jsx";

const SESSION_KEY = "planner_student";

function normalizeCohort(raw) {
        if (!raw) return "";
        const t = String(raw).trim();
        if (/^\d{4}-\d{2}$/.test(t)) return t;          // "2024-01"
        if (/^\d{6}$/.test(t)) return t.slice(0, 4) + "-" + t.slice(4); // "202401" -> "2024-01"
        return t;
}

export default function App() {
        const [student, setStudent] = useState(null);

        useEffect(() => {
                const raw = sessionStorage.getItem("planner_student");
                if (raw) {
                        try {
                                const parsed = JSON.parse(raw);
                                // normalise on load as well, in case old value had no hyphen
                                parsed.cohort = normalizeCohort(parsed.cohort);
                                setStudent(parsed);
                        } catch {
                                // ignore
                        }
                }
        }, []);

        const handleLogin = (s) => {
                // sanitize cohort like "2025-01"
                const cohort = String(s.cohort || "").trim();
                const safe = { ...s, cohort };
                sessionStorage.setItem("planner_student", JSON.stringify(safe));
                setStudent(safe);
        };

        const handleLogout = () => {
                sessionStorage.removeItem("planner_student");
                setStudent(null);
        };

        if (!student) return <Login onLogin={handleLogin} />;

        const planPath = `${student.cohort.trim()}.dsl`; // e.g. "2024-01.dsl"

        return (
            <>
                    <SubjectPlan
                        student={student}
                        planPath={planPath}
                        onLogout={handleLogout}
                    />
            </>
        );
}
