const ProgressCircle = ({ value = 0, size = 44, stroke = 6 }) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(100, value));
    const dash = (clamped / 100) * circumference;

    return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <svg width={size} height={size}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#333"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#4caf50"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>
            <span style={{ fontWeight: 700 }}>{`${Math.round(clamped)}%`}</span>
        </div>
    );
};

export default ProgressCircle;