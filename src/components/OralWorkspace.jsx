import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { parseAppPath, pathForOralPage } from '../appRoutes';
import { Icons } from './Icons';
import { oralRetirements } from '../data/oralRetirements';
import { oralChapters, buildOralBank, chapterForQuestion } from '../data/oralChapters';
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
  const [contentsOpen, setContentsOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const route = parseAppPath(location.pathname);
  const params = new URLSearchParams(location.search);
  const chapterId = route.oralChapter || Number(params.get('chapter')) || 0;
  const selectedId = route.oralQuestion || (!route.oralChapter ? params.get('question') : null);
  const checked = oralProgress?.mastered || {};
  const replacementId = Object.hasOwn(oralRetirements, selectedId) ? oralRetirements[selectedId] : null;
  useEffect(() => {
    if (replacementId) navigate(pathForOralPage(chapterForQuestion(replacementId), replacementId), { replace: true });
  }, [replacementId, navigate]);
  useEffect(() => {
    let active = true;
    setError(false);
    import('../data/crucialQuestionsContent').then(module => {
      if (active) setSources(module.default);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retry]);
  const bank = useMemo(() => buildOralBank(previous, clinical, sources || []), [sources]);
  const selectedQuestion = bank.find(q => q.id === selectedId);
  useEffect(() => {
    if (selectedQuestion && chapterId && selectedQuestion.chapter !== chapterId) {
      navigate(pathForOralPage(selectedQuestion.chapter, selectedQuestion.id), { replace: true });
    }
  }, [selectedQuestion, chapterId, navigate]);
  const chapter = oralChapters.find(ch => ch.id === chapterId);
  const visible = useMemo(() => bank.filter(q => !chapterId || q.chapter === chapterId), [bank, chapterId]);
  const current = visible.find(q => q.id === selectedId);
  useEffect(() => {
    if (current) saveStudyPosition(profileId, {
      path: pathForOralPage(current.chapter, current.id),
      title: current.text, section: 'Προφορικά',
    });
  }, [current, profileId, chapterId]);
  const index = current ? visible.indexOf(current) : -1;
  const select = id => navigate(pathForOralPage(bank.find(q => q.id === id)?.chapter || chapterId, id));
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
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
        <Link to="/oral" aria-current={!chapterId ? 'page' : undefined}>Όλα τα κεφάλαια <small>{bank.length}</small></Link>
        {oralChapters.map(ch => {
          const items = bank.filter(q => q.chapter === ch.id);
          const done = items.filter(q => checked[q.id]).length;
          const complete = items.length > 0 && done === items.length;
          return <Link key={ch.id} to={pathForOralPage(ch.id)} className={complete ? 'is-checked' : ''}
            aria-current={chapterId === ch.id ? 'page' : undefined}>
            <span className="oral-chapter-number">{String(ch.id).padStart(2, '0')}</span>
            <span>{ch.title}</span><small className={done ? 'has-completion' : ''}>{complete && <Icons.Check />}{done}/{items.length}</small>
          </Link>;
        })}
      </nav>}
      <section className="oral-desk" aria-label="Μελέτη προφορικών">
        <div className="oral-desk-heading"><h3>{chapter ? `${chapter.id}. ${chapter.title}` : 'Όλες οι ερωτήσεις'}</h3>
          {current && <Link className="oral-contents-toggle" to={pathForOralPage(chapterId || current.chapter)}>Λίστα ερωτήσεων</Link>}
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
            {current.kind === 'crucial' ? renderCrucial(current) : renderAnswer(current.answer)}
            {current.additionalAnswer.map((paragraph, i) => <div key={i}>{renderAnswer(paragraph)}</div>)}
          </div>
          {(previousSources[current.id] || []).length > 0 && sources && <nav className="oral-related" aria-label="Σχετικές ερωτήσεις">
            <h5>Σχετικές ερωτήσεις</h5>
            <ul>{previousSources[current.id].map(id => {
              const related = bank.find(q => q.id === id);
              return related && <li key={id}><Link to={pathForOralPage(related.chapter, related.id)}>{related.text}</Link></li>;
            })}</ul>
          </nav>}
          <footer className="oral-reading-nav"><button type="button" className="nav-btn" disabled={index <= 0} onClick={() => select(visible[index - 1].id)}><Icons.ChevronLeft /> Προηγούμενη</button>
            <span>{index + 1}/{visible.length}</span><button type="button" className="nav-btn" disabled={index === visible.length - 1} onClick={() => select(visible[index + 1].id)}>Επόμενη <Icons.ChevronRight /></button></footer>
        </article> : <section className="oral-question-index" aria-label="Ερωτήσεις κεφαλαίου">
          <div className="oral-list-caption">{visible.length} ερωτήσεις</div>
          <ol>{visible.map((q, position) => <li key={q.id}><Link to={pathForOralPage(q.chapter, q.id)} className={checked[q.id] ? 'is-checked' : ''}><span className="oral-list-position">{position + 1}</span>
            <span>{q.text}</span>{checked[q.id] && <Icons.Check />}</Link></li>)}</ol>
          {!visible.length && <div className="oral-desk-empty">Δεν έχουν προστεθεί ερωτήσεις σε αυτό το κεφάλαιο.</div>}
        </section>}
      </section>
    </div>
  </div>;
}
