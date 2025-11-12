import { useEffect, useState } from "react";
import { getSchedule } from "../web/apiClient";

export default function ServerSchedule({ studentId }) {
    const [loading, setLoading] = useState(false);
    const [payload, setPayload] = useState(null);
    const [error, setError] = useState("");

    async function load(force = false) {
        try {
            setError(""); setLoading(true);
            const data = await getSchedule(studentId, { force });
            setPayload(data);
        } catch (e) {
            setError(e?.message || "Failed to load schedule");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (studentId) load(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [studentId]);

    if (!studentId) return null;

    return (
        <section style={{marginTop: 24}}>
            <div style={{display:"flex", alignItems:"center", gap:12}}>
                <h2 style={{fontWeight:700}}>Computed schedule (from server)</h2>
                <button onClick={() => load(false)} disabled={loading}>Reload</button>
                <button onClick={() => load(true)} disabled={loading} title="Ignore cache">
                    Force refresh
                </button>
            </div>

            {loading && <div>Loading…</div>}
            {error && <div style={{color:"#b00020"}}>{error}</div>}

            {payload && (
                <>
                    <div style={{opacity:0.7, margin:"6px 0"}}>
                        {payload.student?.programmeCode} • Cohort {payload.student?.cohort} • Generated {new Date(payload.generatedAt).toLocaleString()}
                    </div>
                    <ul style={{lineHeight:1.6}}>
                        {payload.schedule.map((s, i) => (
                            <li key={i}>
                                {s.year}-{s.sem}: {s.subjectCode} ({s.reason})
                            </li>
                        ))}
                    </ul>

                    {payload.overflow?.length > 0 && (
                        <>
                            <div style={{marginTop:12, fontWeight:700}}>Overflow (info):</div>
                            <ul>
                                {payload.overflow.map((s, i) => (
                                    <li key={`o-${i}`}>{s.year}-{s.sem}: {s.subjectCode} ({s.reason})</li>
                                ))}
                            </ul>
                        </>
                    )}
                </>
            )}
        </section>
    );
}
