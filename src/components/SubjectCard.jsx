const SubjectCard = ({ subject, onClear }) => {
    // keep the whole object, so we can read slotKind etc.
    const { code, name, credits, status, type, slotKind } = subject;

    const isElective = type === 'elective';
    const isEmptyElective = isElective && (code === 'ELECTIVE' || /TBD/i.test(name));

    // Helper to determine the specific text (Discipline vs Free)
    const labelForKind = () => {
        if (slotKind === 'discipline') return 'Discipline Elective';
        if (slotKind === 'free')       return 'Free Elective';
        if (slotKind === 'mpu')        return 'MPU';
        return 'Elective';
    };

    // Helper for Badge Styling (To make them look distinct)
    const getBadgeStyle = () => {
        if (!isElective) return {};
        // Distinct colors for Discipline vs Free
        if (slotKind === 'discipline') {
            return {
                background: 'rgba(65, 105, 225, 0.15)', // RoyalBlue tint
                color: 'royalblue',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: '0.9em'
            };
        }
        if (slotKind === 'free') {
            return {
                background: 'rgba(218, 165, 32, 0.15)', // GoldenRod tint
                color: 'goldenrod',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: '0.9em'
            };
        }
        return {}; // Default elective
    };

    // Title (top line)
    const titleText = isEmptyElective
        ? `${labelForKind()} - Select an option`
        : `${code} · ${name}`;

    // Subtitle (second line) construction
    // We render the badge separately in the JSX now for better styling control
    const creditsPart = isEmptyElective ? '' : `${credits ?? ''}${credits ? ' credits' : ''}`;
    const statusPart = ` • ${status}`;

    // coloured left stripe
    const borderColor =
        status === 'Completed'     ? 'green'      :
        status === 'Failed'        ? 'red'    :
        status === 'In Progress'   ? 'orange'     :
        status === 'TBD'           ? 'gray'       :
        'dodgerblue';

    const baseStyle = {
        border: '1px solid var(--border-soft)',
        borderLeftWidth: 6,
        borderLeftColor: borderColor,
        borderRadius: 8,
        padding: '8px 10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        background: 'var(--bg-card)',
        color: 'var(--text-main)',
        transition: 'background 0.15s ease, transform 0.1s ease, box-shadow 0.1s ease, border-color 0.15s ease',
    };

    const emptyElectiveStyle = isEmptyElective ? {
        border: '2px dashed var(--border-soft)',
        borderLeftWidth: 2,
        borderLeftColor: 'var(--border-soft)',
        color: 'var(--text-muted)',
        background: 'var(--bg-card)',
        fontStyle: 'italic',
    } : null;

    return (
        <div className="subject-card" style={{ ...baseStyle, ...(emptyElectiveStyle || {}) }}>
            <div>
                <div style={{ fontWeight: 600 }}>
                    {titleText}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

                    {/* Part 1: Credits */}
                    {creditsPart && <span>{creditsPart}</span>}

                    {/* Part 2: The TYPE Badge (Core, MPU, or specific Elective) */}
                    {isElective ? (
                        <span style={getBadgeStyle()}>
                            {labelForKind()}
                        </span>
                    ) : (
                        <span>• {type === 'mpu' ? 'MPU' : 'Core'}</span>
                    )}

                    {/* Part 3: Status */}
                    <span>{statusPart}</span>

                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Core / MPU subjects: no remove icon */}
                {!isElective && (
                    <button
                        disabled
                        title="Core subjects cannot be removed"
                        style={{ opacity: 0.3, border: 'none', background: 'transparent' }}
                    />
                )}

                {/* Empty elective: no clear button */}
                {isElective && isEmptyElective && (
                    <span style={{ opacity: 0.6, fontSize: 12 }}>&nbsp;</span>
                )}

                {/*
                   Only show button if !isEmptyElective AND onClear exists.
                   If the parent passes onClear={null} (because it's completed), this button vanishes.
                */}
                {isElective && !isEmptyElective && onClear && (
                    <button
                        onClick={onClear}
                        aria-label={`Clear ${name}`}
                        className="app-button icon-button"
                        title="Clear elective"
                    >
                        ×
                    </button>
                )}
            </div>
        </div>
    );
};

export default SubjectCard;