import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icons } from './Icons';
import { oralChapters, buildOralBank } from '../data/oralChapters';
import previous from '../data/oral';
import clinical from '../data/oralCore';
import previousSources from '../data/oralPreviousQuestionSources';
import { saveStudyPosition } from '../lib/studyPosition';
import '../styles/oral-workspace.css';

export default function OralWorkspace({ oralProgress, onQuestionMastered, profileId,
  renderAnswer, renderCrucial }) {
  const [sources, setSources] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const chapterId = Number(params.get('chapter')) || 0;
  const selectedId = params.get('question');
  const checked = oralProgress?.mastered || {};
  useEffect(() => {
    let active = true;
    setError(false);
    import('../data/crucialQuestionsContent').then(module => {
      if (active) setSources(module.default);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retry]);
  const bank = useMemo(() => buildOralBank(previous, clinical, sources || []), [sources]);
  const chapter = oralChapters.find(ch => ch.id === chapterId);
  const visible = useMemo(() => bank.filter(q => !chapterId || q.chapter === chapterId), [bank, chapterId]);
  const current = visible.find(q => q.id === selectedId);
  useEffect(() => {
    if (current) saveStudyPosition(profileId, {
      path: `/oral?${new URLSearchParams({ ...(chapterId ? { chapter: chapterId } : {}), question: current.id })}`,
      title: current.text, section: 'Προφορικά',
    });
  }, [current, profileId, chapterId]);
  const index = current ? visible.indexOf(current) : -1;
  const select = id => setParams({ ...(chapterId ? { chapter: chapterId } : {}), ...(id ? { question: id } : {}) });
  const chooseChapter = id => {
    setParams(id ? { chapter: id } : {});
    setContentsOpen(false);
  };
  const completed = bank.filter(q => checked[q.id]).length;

  return <div className={`oral-workspace ${contentsOpen ? 'contents-open' : ''}`}>
    <header className="oral-workspace-head">
      <div><h2>Προφορικά</h2><p>26 κεφάλαια</p></div>
      <div className="oral-workspace-actions">
        <span className="oral-completed"><Icons.Check /> {completed}/{bank.length}</span>
        <button type="button" className="oral-contents-toggle" aria-expanded={contentsOpen}
          aria-controls="oral-contents" onClick={() => setContentsOpen(open => !open)}>
          <Icons.PanelLeft /> Περιεχόμενα
        </button>
      </div>
    </header>
    <div className="oral-workspace-layout">
      {contentsOpen && <nav id="oral-contents" className="oral-chapters" aria-label="Κεφάλαια προφορικών">
        <button type="button" aria-current={!chapterId ? 'page' : undefined} onClick={() => chooseChapter(0)}>Όλα τα κεφάλαια <small>{bank.length}</small></button>
        {oralChapters.map(ch => {
          const items = bank.filter(q => q.chapter === ch.id);
          const done = items.filter(q => checked[q.id]).length;
          const complete = items.length > 0 && done === items.length;
          return <button key={ch.id} type="button" className={complete ? 'is-checked' : ''}
            aria-current={chapterId === ch.id ? 'page' : undefined} onClick={() => chooseChapter(ch.id)}>
            <span className="oral-chapter-number">{String(ch.id).padStart(2, '0')}</span>
            <span>{ch.title}</span><small className={done ? 'has-completion' : ''}>{complete && <Icons.Check />}{done}/{items.length}</small>
          </button>;
        })}
      </nav>}
      <section className="oral-desk" aria-label="Μελέτη προφορικών">
        <div className="oral-desk-heading"><h3>{chapter ? `${chapter.id}. ${chapter.title}` : 'Όλες οι ερωτήσεις'}</h3>
          {current && <button type="button" className="oral-contents-toggle" onClick={() => select(null)}>Λίστα ερωτήσεων</button>}
        </div>
        {!sources && !error && <p role="status">Φόρτωση κρίσιμων θεμάτων…</p>}
        {error && <p role="alert">Τα κρίσιμα θέματα δεν φορτώθηκαν. <button type="button" onClick={() => setRetry(value => value + 1)}>Δοκιμή ξανά</button></p>}
        {current ? <article className="oral-reading" key={current.id}>
          <div className="oral-reading-heading"><h4>{current.text}</h4>
            <button type="button" className={`oral-check ${checked[current.id] ? 'is-checked' : ''}`}
              aria-label="Ολοκληρώθηκε" aria-pressed={Boolean(checked[current.id])} title="Σημείωση ολοκλήρωσης"
              onClick={() => onQuestionMastered(current.id, !checked[current.id])}><Icons.Check /></button>
          </div>
          <div className="oral-reading-answer">
            {current.kind === 'crucial' ? renderCrucial(current) : <>
              {renderAnswer(current.answer)}
              {(previousSources[current.id] || []).map(id => {
                const source = sources?.find(item => item.id === id);
                return source && <section className="oral-supplement" key={id}>{renderCrucial(source)}</section>;
              })}
            </>}
          </div>
          <footer className="oral-reading-nav"><button type="button" className="nav-btn" disabled={index <= 0} onClick={() => select(visible[index - 1].id)}><Icons.ChevronLeft /> Προηγούμενη</button>
            <span>{index + 1}/{visible.length}</span><button type="button" className="nav-btn" disabled={index === visible.length - 1} onClick={() => select(visible[index + 1].id)}>Επόμενη <Icons.ChevronRight /></button></footer>
        </article> : <section className="oral-question-index" aria-label="Ερωτήσεις κεφαλαίου">
          <div className="oral-list-caption">{visible.length} ερωτήσεις</div>
          <ol>{visible.map((q, position) => <li key={q.id}><button type="button" className={checked[q.id] ? 'is-checked' : ''}
            onClick={() => select(q.id)}><span className="oral-list-position">{position + 1}</span>
            <span>{q.text}</span>{checked[q.id] && <Icons.Check />}</button></li>)}</ol>
          {!visible.length && <div className="oral-desk-empty">Δεν έχουν προστεθεί ερωτήσεις σε αυτό το κεφάλαιο.</div>}
        </section>}
      </section>
    </div>
  </div>;
}
