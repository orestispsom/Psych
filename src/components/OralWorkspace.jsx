import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Icons } from './Icons';
import { oralChapters, buildOralBank } from '../data/oralChapters';
import previous from '../data/oral';
import clinical from '../data/oralCore';
import previousSources from '../data/oralPreviousQuestionSources';
import { saveStudyPosition } from '../lib/studyPosition';
import '../styles/oral-workspace.css';

const labels = { past: 'Θέμα εξετάσεων', clinical: 'Κλινική ερώτηση', crucial: 'Κρίσιμο θέμα' };
const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('el').replace(/ς/g, 'σ').trim();

export default function OralWorkspace({ oralProgress, onQuestionMastered, onQuestionsMastered, profileId,
  renderAnswer, renderCrucial, ExamSimulator, onHome }) {
  const [sources, setSources] = useState(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [params, setParams] = useSearchParams();
  const [revealedId, setRevealedId] = useState(null);
  const chapterId = Number(params.get('chapter')) || 0;
  const selectedId = params.get('question');
  const mode = params.get('mode') === 'exam' ? 'exam' : 'study';
  const query = params.get('search') || '';
  const filter = params.get('filter') || 'all';
  const kind = params.get('source') || 'all';
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
  const visible = useMemo(() => bank.filter(q => (!chapterId || q.chapter === chapterId)
    && (kind === 'all' || q.kind === kind)
    && (filter === 'all' || (filter === 'checked' ? checked[q.id] : !checked[q.id]))
    && normalize(`${q.text} ${q.id} ${q.context} ${oralChapters[q.chapter - 1]?.title}`).includes(normalize(query))),
  [bank, chapterId, kind, filter, checked, query]);
  const current = visible.find(q => q.id === selectedId);
  useEffect(() => {
    if (current) saveStudyPosition(profileId, { path: `/oral?${params}`, title: current.text, section: 'Προφορικά' });
  }, [current, profileId, params]);
  const index = current ? visible.indexOf(current) : -1;
  const patch = (updates, replace = false) => {
    setParams(previousParams => {
      const next = new URLSearchParams(previousParams);
      Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
      return next;
    }, { replace });
  };
  const select = id => { setRevealedId(null); patch({ question: id }); };
  const scopedClinical = clinical.filter(q => !chapterId || bank.find(item => item.id === q.id)?.chapter === chapterId);
  const hasExam = scopedClinical.some(q => q.role === 'anchor' || q.role === 'case_anchor');
  const completed = bank.filter(q => checked[q.id]).length;

  return <div className={`oral-workspace ${current ? 'has-question' : ''}`}>
    <header className="oral-workspace-head">
      <div><span className="sheet-eyebrow">Προετοιμασία ειδικότητας</span><h2>Προφορικά</h2>
        <p>26 κεφάλαια · Μελέτη και προφορική εξάσκηση σε έναν χώρο</p></div>
      <span className="oral-completed"><Icons.Check /> {completed}/{bank.length}</span>
    </header>
    <label className="oral-mobile-chapter">Κεφάλαιο
      <select value={chapterId} onChange={event => patch({ chapter: event.target.value === '0' ? null : event.target.value, question: null })}>
        <option value="0">Όλα τα κεφάλαια</option>
        {oralChapters.map(ch => <option key={ch.id} value={ch.id}>{ch.id}. {ch.title}</option>)}
      </select>
    </label>
    <div className="oral-workspace-layout">
      <nav className="oral-chapters" aria-label="Κεφάλαια προφορικών">
        <h3>Περιεχόμενα</h3>
        <button type="button" aria-current={!chapterId ? 'page' : undefined} onClick={() => patch({ chapter: null, question: null })}>Όλα τα κεφάλαια <small>{bank.length}</small></button>
        {oralChapters.map(ch => {
          const items = bank.filter(q => q.chapter === ch.id);
          return <button key={ch.id} type="button" aria-current={chapterId === ch.id ? 'page' : undefined}
            onClick={() => patch({ chapter: String(ch.id), question: null })}>
            <span className="oral-chapter-number">{String(ch.id).padStart(2, '0')}</span>
            <span>{ch.title}</span><small>{items.filter(q => checked[q.id]).length}/{items.length}</small>
          </button>;
        })}
      </nav>
      <section className="oral-desk" aria-label="Μελέτη προφορικών">
        <div className="oral-desk-heading"><span className="sheet-eyebrow">{chapter ? `Κεφάλαιο ${chapter.id}` : 'Ενιαία τράπεζα'}</span>
          <h3>{chapter?.title || 'Όλες οι ερωτήσεις'}</h3></div>
        <div className="oral-desk-controls">
          <div className="oral-view-switch" aria-label="Τρόπος εξάσκησης">
            <button type="button" aria-pressed={mode === 'study'} onClick={() => patch({ mode: null })}>Μελέτη</button>
            <button type="button" aria-pressed={mode === 'exam'} onClick={() => patch({ mode: 'exam' })}>Προφορική εξέταση</button>
          </div>
          {mode === 'study' && <>
            <input type="search" aria-label="Αναζήτηση προφορικών" placeholder="Αναζήτηση ερώτησης…" value={query}
              onChange={event => patch({ search: event.target.value, question: null }, true)} />
            <label>Πηγή<select value={kind} onChange={event => patch({ source: event.target.value, question: null })}>
              <option value="all">Όλες οι πηγές</option><option value="past">Θέματα εξετάσεων</option>
              <option value="clinical">Κλινικές ερωτήσεις</option><option value="crucial">100 Κρίσιμα Θέματα</option>
            </select></label>
            <label>Πρόοδος<select value={filter} onChange={event => patch({ filter: event.target.value, question: null })}>
              <option value="all">Όλες</option><option value="pending">Χωρίς ✓</option><option value="checked">Με ✓</option>
            </select></label>
          </>}
        </div>
        {!sources && !error && <p role="status">Φόρτωση κρίσιμων θεμάτων…</p>}
        {error && <p role="alert">Τα κρίσιμα θέματα δεν φορτώθηκαν. <button type="button" onClick={() => setRetry(value => value + 1)}>Δοκιμή ξανά</button></p>}
        {mode === 'exam' ? hasExam ? <ExamSimulator key={`${profileId}-${chapterId}`} questionBank={scopedClinical}
          onBack={() => patch({ mode: null })} onHome={onHome} oralProgress={oralProgress}
          onQuestionMastered={onQuestionMastered} onQuestionsMastered={onQuestionsMastered} />
          : <div className="oral-desk-empty">Δεν υπάρχει κλινικό σενάριο εξέτασης σε αυτό το κεφάλαιο. Επίλεξε «Μελέτη» ή «Όλα τα κεφάλαια».</div>
        : <div className="oral-study-layout">
          <section className="oral-question-index" aria-label="Ερωτήσεις κεφαλαίου">
            <div className="oral-list-caption">{visible.length} ερωτήσεις</div>
            <ol>{visible.map((q, position) => <li key={q.id}><button type="button" aria-current={q.id === current?.id ? 'true' : undefined}
              onClick={() => select(q.id)}><span className="oral-list-position">{position + 1}</span>
              <span><small>{labels[q.kind]}</small>{q.text}</span>{checked[q.id] && <Icons.Check />}</button></li>)}</ol>
            {!visible.length && <div className="oral-desk-empty">{bank.some(q => q.chapter === chapterId) || !chapterId
              ? 'Δεν υπάρχουν ερωτήσεις με αυτά τα φίλτρα.' : 'Δεν έχουν προστεθεί ερωτήσεις σε αυτό το κεφάλαιο.'}</div>}
          </section>
          {current ? <article className="oral-reading" key={current.id}>
            <button type="button" className="back-link oral-return-list" onClick={() => patch({ question: null })}><Icons.ChevronLeft /> Λίστα ερωτήσεων</button>
            <div className="oral-reading-meta"><span>{labels[current.kind]} · {current.id}</span>
              <button type="button" className={`oral-check ${checked[current.id] ? 'is-checked' : ''}`}
                aria-label="Ολοκληρώθηκε" aria-pressed={Boolean(checked[current.id])} title="Σημείωση ολοκλήρωσης"
                onClick={() => onQuestionMastered(current.id, !checked[current.id])}><Icons.Check /></button></div>
            <h4>{current.text}</h4>
            <p className="oral-reading-context">{oralChapters[current.chapter - 1]?.title}</p>
            {revealedId === current.id ? <div className="oral-reading-answer">
              {current.kind === 'crucial' ? renderCrucial(current) : <>
                {renderAnswer(current.answer)}
                {(current.source || current.context) && <p className="oral-reading-context">{current.source || current.context}</p>}
                {(previousSources[current.id] || []).map(id => {
                  const source = sources?.find(item => item.id === id);
                  return source && <details key={id}><summary>{source.title}</summary>{renderCrucial(source)}</details>;
                })}
              </>}
              <button type="button" className="back-link" onClick={() => setRevealedId(null)}>Απόκρυψη απάντησης</button>
            </div> : <div className="oral-recall"><p>Απάντησε προφορικά πριν δεις την απάντηση.</p>
              <button type="button" className="results-btn" onClick={() => setRevealedId(current.id)}><Icons.Eye /> Εμφάνιση απάντησης</button></div>}
            <footer className="oral-reading-nav"><button type="button" className="nav-btn" disabled={index <= 0} onClick={() => select(visible[index - 1].id)}><Icons.ChevronLeft /> Προηγούμενη</button>
              <span>{index + 1}/{visible.length}</span><button type="button" className="nav-btn" disabled={index === visible.length - 1} onClick={() => select(visible[index + 1].id)}>Επόμενη <Icons.ChevronRight /></button></footer>
          </article> : <div className="oral-reading oral-reading-idle"><Icons.BookOpen /><h4>Διάλεξε μια ερώτηση</h4><p>Ανάκληση, απάντηση, ένα ✓ όταν ολοκληρωθεί.</p></div>}
        </div>}
      </section>
    </div>
  </div>;
}
