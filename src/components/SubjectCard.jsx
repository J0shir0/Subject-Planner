const SubjectCard = ({ subject, onClear }) => {
    // keep the whole object so we can read slotKind etc.
    const { code, name, credits, status, type, slotKind } = subject;

    const isElective = type === 'elective';
    const isEmptyElective = isElective && (code === 'ELECTIVE' || /TBD/i.test(name));

    const labelForKind = () => {
        if (slotKind === 'discipline') return 'Discipline Elective';
        if (slotKind === 'free')       return 'Free Elective';
        if (slotKind === 'mpu')        return 'MPU';
        return 'Elective';
    };

    // Title (top line)
    const titleText = isEmptyElective
        ? `${labelForKind()} - Select an option`
        : `${code} · ${name}`;

    // kind label for non-empty subjects
    const kindLabel = isElective
        ? 'Elective'
        : (type === 'mpu' ? 'MPU' : 'Core');

    // Subtitle (second line)
    const subtitleText = isEmptyElective
        ? `${labelForKind()} • ${status}` // no credits for empty slot
        : `${credits ?? ''}${credits ? ' credits • ' : ''}${kindLabel} • ${status}`;

    const borderColor =
        status === 'Completed'   ? 'green'      :
            status === 'In Progress' ? 'orange'     :
                status === 'TBD'         ? 'gray'       :
                    'dodgerblue';

    const baseStyle = {
        border: '1px solid #444',
        borderLeftWidth: 6,
        borderLeftColor: borderColor,
        borderRadius: 8,
        padding: '8px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        background: '#121212',
    };

    // empty slots get a dashed, muted look (INCLUDING grey left border)
    const emptyElectiveStyle = isEmptyElective ? {
        border: '2px dashed #777',
        borderLeftWidth: 2,       // remove colored stripe emphasis
        borderLeftColor: '#777',  // ← make the dashed border grey
        color: '#b0b0b0',
        background: '#0e0e0e',
        fontStyle: 'italic',
    } : null;

    return (
        <div style={{ ...baseStyle, ...(emptyElectiveStyle || {}) }}>
            <div>
                <div style={{ fontWeight: 600 }}>
                    {titleText}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                    {subtitleText}
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Core / MPU subjects: no remove icon */}
                {!isElective && (
                    <button
                        disabled
                        title="Core subjects cannot be removed"
                        style={{ opacity: 0.3 }}
                    />
                )}
                {/* Empty elective: no clear button */}
                {isElective && isEmptyElective && (
                    <span style={{ opacity: 0.6, fontSize: 12 }}>&nbsp;</span>
                )}
                {/* Chosen elective: show clear */}
                {isElective && !isEmptyElective && (
                    <button
                        onClick={onClear}
                        aria-label={`Clear ${name}`}
                        title="Clear elective"
                    >
                        X
                    </button>
                )}
            </div>
        </div>
    );
};

export default SubjectCard;
