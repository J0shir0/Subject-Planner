import ProgressCircle from './ProgressCircle.jsx';

const TopBar = ({
                    onReset,
                    progress= 0,
                    student,
                    onLogout
}) => {
    return (
        <header
            style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderBottom: '1px solid #333',
                position: 'sticky',
                top: 0,
                background: '#111',
                color: '#eee',
                zIndex: 10,
            }}
        >
            <div style={{fontWeight: 700, display: 'flex', alignItems: 'center', gap: 12}}>
                Subject Planner
                <ProgressCircle value={progress}/>
            </div>

            <div style={{opacity: 0.8}}>
                Name: {student ? `${student.name}
                Student ID: ${student.studentId}  
                Cohort: ${student.cohort}` : ""}
            </div>

            <div style={{display: 'flex', gap: 8}}>
                {onReset && <button onClick={onReset}>Reset</button>}
                {onLogout && <button onClick={onLogout}>Logout</button>}
            </div>
        </header>
    );
};


export default TopBar;
