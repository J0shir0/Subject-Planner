import { useState } from "react";
import { fetchStudent } from "../web/apiClient";

// Must match App.jsx
function normalizeCohort(raw) {
    if (!raw) return "";
    const t = String(raw).trim();
    if (/^\d{4}-\d{2}$/.test(t)) return t;
    if (/^\d{6}$/.test(t)) return t.slice(0, 4) + "-" + t.slice(4);
    return t;
}

export default function Login({ onLogin }) {
    const [studentId, setStudentId] = useState("");
    const [ic, setIc] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const inputStyle = {
        width: "100%",
        padding: "8px 10px",
        background: "#1c1c1c",
        color: "white",
        border: "1px solid #333",
        borderRadius: 6
    };

    const submit = async (e) => {
        e.preventDefault();
        setError("");

        const rawId = studentId.trim();
        const rawIc = ic.trim();

        if (!rawId) {
            setError("Student ID is required.");
            return;
        }
        if (!rawIc) {
            setError("IC is required.");
            return;
        }

        setLoading(true);
        try {
            const dbStudent = await fetchStudent(rawId);

            // Extract IC from database record
            const dbIc =
                (dbStudent.ic ??
                    dbStudent.icno ??
                    dbStudent.ic_number ??
                    "").toString().trim();

            if (!dbIc) {
                throw new Error("IC not found for this student in the database.");
            }
            if (dbIc !== rawIc) {
                throw new Error("Student ID and IC do not match our records.");
            }

            // Final cohort normalization
            const cohort = normalizeCohort(dbStudent.cohort);

            const safeStudent = {
                ...dbStudent,
                studentId: dbStudent.id ?? rawId,
                cohort
            };

            onLogin(safeStudent);
        } catch (e) {
            console.warn("[Login] Failed:", e);
            setError(e?.message || "Login failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                background: "#0b0b0b",
                color: "#eee"
            }}
        >
            <form
                onSubmit={submit}
                style={{
                    width: 360,
                    padding: 18,
                    border: "1px solid #333",
                    borderRadius: 12,
                    background: "#131313"
                }}
            >
                <h2 style={{ marginTop: 0 }}>Sign in</h2>

                <label style={{ display: "block", marginBottom: 8 }}>
                    Student ID
                </label>
                <input
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. 6076690"
                    style={inputStyle}
                />

                <label
                    style={{ display: "block", margin: "12px 0 8px" }}
                >
                    IC / Passport
                </label>
                <input
                    value={ic}
                    onChange={(e) => setIc(e.target.value)}
                    placeholder="e.g. 9910832"
                    style={inputStyle}
                />

                {error && (
                    <div style={{ color: "#f66", marginTop: 10 }}>{error}</div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        marginTop: 16,
                        width: "100%",
                        padding: "10px 0",
                        background: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer"
                    }}
                >
                    {loading ? "Signing in…" : "Continue"}
                </button>
            </form>
        </div>
    );
}
