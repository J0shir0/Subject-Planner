import { useEffect, useState } from "react";
import SubjectPlan from "./components/SubjectPlan.jsx";
import Login from "./components/Login.jsx";

export default function App() {
        const [student, setStudent] = useState(null);

        useEffect(() => {
                const raw = localStorage.getItem("planner_student");
                if (raw) setStudent(JSON.parse(raw));
        }, []);

        const handleLogin = (s) => {
                // sanitize cohort like "2025-01"
                const cohort = String(s.cohort || "").trim();
                const safe = { ...s, cohort };
                localStorage.setItem("planner_student", JSON.stringify(safe));
                setStudent(safe);
        };

        const handleLogout = () => {
                localStorage.removeItem("planner_student");
                setStudent(null);
        };

        if (!student) return <Login onLogin={handleLogin} />;

        const planPath = `${student.cohort.trim()}.dsl`; // e.g. "2024-01.dsl"
        <SubjectPlan student={student} planPath={planPath} onLogout={handleLogout} />


        return (
            <SubjectPlan
                student={student}
                planPath={planPath}
                onLogout={handleLogout}
            />
        );
}
