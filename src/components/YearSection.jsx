import SemesterColumn from './SemesterColumn.jsx';

const YearSection = ({ year, semesters, onAddSubject, onRemoveSubject, onOpenElective, onChangeStatus, onClearElective, onDropElective  }) => (
    <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '8px 0' }}>{`Year ${year}`}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {semesters.map(({ id, title, subjects }) => (
                <SemesterColumn
                    key={id}
                    semesterId={id}
                    title={title}
                    subjects={subjects}
                    onAddSubject={onAddSubject}
                    onRemoveSubject={onRemoveSubject}
                    onOpenElective={onOpenElective}
                    onChangeStatus={onChangeStatus}
                    onClearElective={onClearElective}
                    onDropElective={onDropElective}
                />
            ))}
        </div>
    </section>
);

export default YearSection;