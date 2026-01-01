import { useState } from "react";
import SubjectCard from "./SubjectCard.jsx";

const SemesterColumn = ({
                            semesterId,
                            title,
                            subjects,
                            onAddSubject,
                            onRemoveSubject,
                            onOpenElective,
                            onChangeStatus,
                            onClearElective,
                            onDropElective,
                        }) => {
    // highlight state for the slot currently being hovered
    const [dragOverId, setDragOverId] = useState(null);

    // Allow elective options (from the panel) to hover over an elective slot
    const handleSlotDragOver = (e, subject) => {
        // LOCK: Don't allow dropping on completed subjects
        if (subject.type !== "elective" || subject.status === 'Completed') return;

        e.preventDefault();// enables drop
        e.dataTransfer.dropEffect = "copy";
        setDragOverId(subject.id);
    };

    // Handle the actual drop: apply the chosen elective to this slot
    const handleSlotDrop = (e, subject, data) => {
        e.preventDefault();
        // LOCK: Double check status on drop
        if (subject.status === 'Completed') return;

        console.log('drop on slot', subject.id, data);
        setDragOverId(null);
        try {
            const data = JSON.parse(e.dataTransfer.getData("text/plain"));
            if (data?.kind !== "electiveOption") return;

            // Optional safety: only allow same-bucket drops
            if (subject.bucketId && data.bucketId && subject.bucketId !== data.bucketId) {
                return;
            }

            // Fill THIS slot with the dropped elective
            onDropElective?.({
                slotId: subject.id, // target slot (this card)
                subjectId: data.subjectId,
                title: data.title,
                credits: data.credits,
            });
        } catch {
            // bad payloads are ignored
        }
    };

    return (
        <div style={{ border: "1px solid #333", borderRadius: 8, padding: 12 }}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                }}
            >
                <h3 style={{margin:0}}>{title}</h3>
                {onAddSubject && <button onClick={() => onAddSubject(semesterId)}>+ Add Subject</button>}
            </div>

            {subjects.length === 0 ? (
                <p style={{ opacity: 0.7 }}>No subjects yet.</p>
            ) : (
                <ul
                    style={{
                        listStyle: "none",
                        padding: 0,
                        margin: 0,
                        display: "grid",
                        gap: 8,
                    }}
                >
                    {subjects.map((subject) => {
                        const isElectiveSlot = subject.type === "elective";
                        const isDragTarget = isElectiveSlot && dragOverId === subject.id;

                        // Check if subject is locked
                        const isCompleted = subject.status === 'Completed';

                        return (
                            <li
                                key={subject.id}
                                // Make ELECTIVE SLOTS droppable (Only if not completed)
                                onDragOver={(e) => isElectiveSlot && handleSlotDragOver(e, subject)}
                                onDrop={(e) => isElectiveSlot && handleSlotDrop(e, subject)}
                                onDragLeave={() => isElectiveSlot && setDragOverId(null)}
                                style={{
                                    // subtle highlight when a draggable option hovers this slot
                                    padding: isElectiveSlot ? 4 : 0,
                                    borderRadius: 8,
                                    background: isDragTarget ? "rgba(30,144,255,0.18)" : "transparent",
                                    transition: "background 120ms ease",
                                }}
                            >
                                <SubjectCard
                                    subject={subject}
                                    onRemove={() => onRemoveSubject(semesterId, subject.id)}
                                    onChangeStatus={(next) =>
                                        onChangeStatus?.(semesterId, subject.id, next)
                                    }
                                    // LOCK: If completed, pass null so SubjectCard doesn't render the 'X'
                                    onClear={isCompleted ? null : () => onClearElective?.(semesterId, subject.id)}
                                />

                                {/** Show action for electives; BUT HIDE IF COMPLETED */}
                                {isElectiveSlot && subject.bucketId && !isCompleted && (
                                    <div style={{ marginTop: 6 }}>
                                        <button
                                            className="app-button"
                                            onClick={() =>
                                                onOpenElective?.({
                                                    slotId: subject.id,
                                                    bucketId: subject.bucketId,
                                                })
                                            }
                                            title={
                                                subject.code === "ELECTIVE"
                                                    ? "Pick Elective"
                                                    : "Change Elective"
                                            }
                                        >
                                            {subject.code === "ELECTIVE"
                                                ? "Pick Elective"
                                                : "Change Elective"}
                                        </button>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default SemesterColumn;