import { useState } from "react";

export default function Login({ onLogin }) {
    const [studentId, setStudentId] = useState("");
    const [name, setName] = useState("");
    const [cohort, setCohort] = useState("2025-01"); // default; change as you like

    const submit = (e) => {
        e.preventDefault();
        if (!studentId || !cohort) return;
        const student = { studentId, name: name.trim() || studentId, cohort };
        // persist simple session
        localStorage.setItem("planner_student", JSON.stringify(student));
        onLogin?.(student);
    };

    return (
        <div style={{minHeight:"100vh", display:"grid", placeItems:"center", background:"#0b0b0b", color:"#eee"}}>
            <form onSubmit={submit} style={{width:360, padding:18, border:"1px solid #333", borderRadius:12, background:"#131313"}}>
                <h2 style={{marginTop:0}}>Sign in</h2>

                <label style={{display:"block", marginBottom:8}}>Student ID</label>
                <input value={studentId} onChange={e=>setStudentId(e.target.value)}
                       placeholder="e.g. 9897587" style={inputStyle} />

                <label style={{display:"block", margin:"12px 0 8px"}}>Name (optional)</label>
                <input value={name} onChange={e=>setName(e.target.value)}
                       placeholder="Your name" style={inputStyle} />

                <label style={{display:"block", margin:"12px 0 8px"}}>Cohort</label>
                {/* For now, a free text or a small list. You can expand later. */}
                <input value={cohort} onChange={e=>setCohort(e.target.value)}
                       placeholder="YYYY-MM e.g. 2025-01" style={inputStyle} />

                <button type="submit" style={{marginTop:16, width:"100%"}}>Continue</button>
            </form>
        </div>
    );
}

const inputStyle = {
    width:"100%", padding:"8px 10px", borderRadius:8, border:"1px solid #444",
    background:"#0e0e0e", color:"#eee"
};
