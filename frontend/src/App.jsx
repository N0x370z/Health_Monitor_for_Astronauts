import { useState } from 'react';
import CrewDetail from './views/CrewDetail.jsx';
import CrewOverview from './views/CrewOverview.jsx';
import ProblemsView from './views/ProblemsView.jsx';
import StudyView from './views/StudyView.jsx';

const TABS = [
  { id: 'crew', label: 'Tripulación' },
  { id: 'problems', label: 'Problemas y prevención' },
  { id: 'study', label: 'Evidencia CFT70' },
];

export default function App() {
  const [tab, setTab] = useState('crew');
  const [crew, setCrew] = useState(null);

  const openCrew = (code) => {
    setTab('crew');
    setCrew(code);
  };

  return (
    <>
      <header className="topbar">
        <div className="brand"><span className="brand-dot" />Health Monitor · Cardiovascular</div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); setCrew(null); }}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'crew' && !crew && <CrewOverview onSelectCrew={openCrew} />}
        {tab === 'crew' && crew && <CrewDetail code={crew} onBack={() => setCrew(null)} />}
        {tab === 'problems' && <ProblemsView />}
        {tab === 'study' && <StudyView />}
      </main>
    </>
  );
}
