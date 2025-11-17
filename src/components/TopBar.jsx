import ProgressCircle from './ProgressCircle.jsx';

const TopBar = ({ progress = 0, student, onLogout, theme = 'dark', onToggleTheme }) => {
    return (
        <header
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                background: 'var(--bg-card)',
                borderBottom: '1px solid var(--border-soft)',
                color: 'var(--text-main)',
                position: 'sticky',
                top: 0,
                zIndex: 50
            }}
        >
            {/* Left: Title + progress */}
            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12 }}>
                Subject Planner
                <ProgressCircle value={progress} />
            </div>

            {/* Middle: Student details */}
            <div style={{ opacity: 0.85, textAlign: 'center' }}>
                {student && (
                    <>
                        Name: {student.name} &nbsp;&nbsp;|&nbsp;&nbsp;
                        Student ID: {student.studentId} &nbsp;&nbsp;|&nbsp;&nbsp;
                        Cohort: {student.cohort}
                    </>
                )}
            </div>

            {/* Right: Theme toggle + Logout */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {onToggleTheme && (
                    <button
                        type="button"
                        className="app-button"
                        onClick={onToggleTheme}
                        title={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
                        style={{ paddingInline: 10, minWidth: 0 }}
                    >
                        ☀︎
                    </button>
                )}
                {onLogout && (
                    <button className="app-button" onClick={onLogout}>
                        Logout
                    </button>
                )}
            </div>
        </header>
    );
};

export default TopBar;
