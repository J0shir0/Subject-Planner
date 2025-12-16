import { useEffect, useState, useRef } from "react";

export default function ElectivePanel({ slot, studentId, onClose, onChoose, theme = "dark" }) {
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState("");
    const [options, setOptions] = useState([]);
    const [query, setQuery] = useState("");

    const isLight = theme === "light";

    const [pos, setPos] = useState({ x: 0, y: 0 }); // pixels from center
    const dragRef = useRef({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });

    const onHeaderMouseDown = (e) => {
        e.preventDefault();
        dragRef.current = {
            dragging: true,
            startX: e.clientX,
            startY: e.clientY,
            originX: pos.x,
            originY: pos.y
        };
        window.addEventListener("mousemove", onHeaderMouseMove);
        window.addEventListener("mouseup", onHeaderMouseUp, { once: true });
    };

    const onHeaderMouseMove = (e) => {
        const st = dragRef.current;
        if (!st.dragging) return;
        const dx = e.clientX - st.startX;
        const dy = e.clientY - st.startY;
        setPos({ x: st.originX + dx, y: st.originY + dy });
    };

    const onHeaderMouseUp = () => {
        dragRef.current.dragging = false;
        window.removeEventListener("mousemove", onHeaderMouseMove);
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                setErr(""); setLoading(true);
                if (slot.options && slot.options.length) {
                    setOptions(slot.options);
                } else {
                    // fallback (only if you still want)
                    const res = await fetch(`/buckets/${slot.bucketId}.json`);
                    const data = await res.json();
                    setOptions(Array.isArray(data.options) ? data.options : []);
                }
            } catch (e) {
                setErr(e.message || "Could not load options");
                setOptions([]);
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [slot.bucketId, slot.options]);

    const filtered = options.filter(o =>
        (o.title + o.subjectId).toLowerCase().includes(query.toLowerCase())
    );

    // --- THEME STYLES --------------------------
    const backdropStyle = {
        position: "fixed",
        inset: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 50,
        pointerEvents: "none",
        background: isLight ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.45)", // make light mode not too harsh
    };

    const modalStyle = {
        background: isLight ? "#ffffff" : "#0f0f0f",
        color: isLight ? "#111111" : "#eeeeee",
        border: `1px solid ${isLight ? "#dddddd" : "#2b2b2b"}`,
        borderRadius: 12,
        padding: 16,
        width: 420,
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        pointerEvents: "auto",
    };

    const inputStyle = {
        width: "100%",
        margin: "8px 0",
        padding: 8,
        borderRadius: 8,
        border: `1px solid ${isLight ? "#cccccc" : "#333333"}`,
        background: isLight ? "#ffffff" : "#141414",
        color: isLight ? "#111111" : "#eeeeee",
        outline: "none",
    };

    const headerButtonStyle = {
        border: `1px solid ${isLight ? "#cccccc" : "#333333"}`,
        background: isLight ? "#f6f6f6" : "#151515",
        color: isLight ? "#111111" : "#eeeeee",
        borderRadius: 8,
        padding: "4px 10px",
        cursor: "pointer",
    };

    const rowBorder = isLight ? "#e6e6e6" : "#2f2f2f";

    const selectButtonStyle = {
        border: `1px solid ${isLight ? "#bbbbbb" : "#444444"}`,
        background: isLight ? "#ffffff" : "#1a1a1a",
        color: isLight ? "#111111" : "#eeeeee",
        borderRadius: 10,
        padding: "6px 12px",
        cursor: "pointer",
        fontWeight: 600,
    };
    // -----------------------------------------------------------------

    return (
        <div style={backdropStyle}>
            <div
                style={{
                    ...modalStyle,
                    transform: `translate(${pos.x}px, ${pos.y}px)`  // ← follows your drag
                }}
                role="dialog"
                aria-modal="true"
            >
                <div
                    onMouseDown={onHeaderMouseDown}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "move" }}
                >
                    <h3 style={{ margin: 0 }}>
                        {slot?.slotKind === 'discipline' ? 'Pick Discipline Elective'
                            : slot?.slotKind === 'free' ? 'Pick Free Elective'
                                : slot?.slotKind === 'mpu' ? 'Pick MPU'
                                    : 'Pick Elective'}
                    </h3>

                    {/* close button */}
                    <button onClick={onClose} aria-label="Close" style={headerButtonStyle}>✕</button>
                </div>

                {loading && <p>Loading…</p>}
                {err && <p style={{ color: isLight ? "#b00020" : "salmon" }}>{err}</p>}

                {!loading && !err && (
                    <>
                        <input
                            placeholder="Search electives…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            style={inputStyle}
                        />

                        <ul style={{ maxHeight: 280, overflow: "auto", margin: 0, padding: 0 }}>
                            {filtered.map(o => (
                                <li
                                    key={o.subjectId}
                                    draggable
                                    onDragStart={(e) => {
                                        // package what the drop target needs
                                        const payload = {
                                            kind: "electiveOption",
                                            slotId: slot.slotId,         // which slot we’re filling
                                            bucketId: slot.bucketId,     // sanity check on drop
                                            subjectId: o.subjectId,
                                            title: o.title,
                                            credits: o.credits
                                        };
                                        e.dataTransfer.setData("text/plain", JSON.stringify(payload));
                                        e.dataTransfer.effectAllowed = "copy";
                                    }}
                                    style={{
                                        listStyle: "none",
                                        padding: 8,
                                        borderBottom: `1px solid ${rowBorder}`,
                                        cursor: "grab"
                                    }}
                                    title="Drag me onto the elective slot"
                                >
                                    <div style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        gap: 12
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{o.title}</div>
                                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                                                {o.subjectId} · {o.credits} credits
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => onChoose({
                                                slotId: slot.slotId,
                                                subjectId: o.subjectId,
                                                title: o.title,
                                                credits: o.credits
                                            })}
                                            style={selectButtonStyle}
                                        >
                                            Select
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {filtered.length === 0 && (
                                <li style={{ padding: 8, opacity: 0.7, listStyle: "none" }}>
                                    No matches
                                </li>
                            )}
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
}
