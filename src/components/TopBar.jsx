import ProgressCircle from './ProgressCircle.jsx';

const TopBar = ({ onReset, progress = 0, student, onLogout }) => {
    return (
        <header /* ...styles unchanged... */>
            <div style={{fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12}}>
                Subject Planner
                <ProgressCircle value={progress}/>
            </div>

            <div style={{opacity: 0.8}}>
                {student ? (
                    <>
                        Name: {student.name || student.studentId} &nbsp;&nbsp;|&nbsp;&nbsp;
                        Student ID: {student.studentId} &nbsp;&nbsp;|&nbsp;&nbsp;
                        Cohort: {student.cohort}
                    </>
                ) : null}
            </div>

            <div style={{display: 'flex', gap: 8}}>
                {onReset && <button onClick={onReset}>Reset</button>}
                {onLogout && <button onClick={onLogout}>Logout</button>}
            </div>
        </header>
    );
};

export default TopBar;