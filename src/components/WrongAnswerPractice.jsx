import { useRef, useState } from 'react';
import { Icons } from './Icons.jsx';
import { useWindowKeydown } from '../lib/useWindowKeydown.js';

function optionOrders(questions) {
  return Object.fromEntries(questions.map(question => {
    const order = question.options.map((_, index) => index);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const other = Math.floor(Math.random() * (index + 1));
      [order[index], order[other]] = [order[other], order[index]];
    }
    return [question.id, order];
  }));
}

const correctOptions = question => Array.isArray(question.correct) ? question.correct : [question.correct];
const isCorrect = (question, selection = []) => {
  const expected = correctOptions(question);
  return selection.length === expected.length && expected.every(index => selection.includes(index));
};

// Keeps each source test mounted and intact. Retries have their own answers,
// locks and session ID; specialised banks retain their multiple-answer rules.
export default function WrongAnswerPractice({ questions: initialQuestions, title, context, onBack, onAnswer, isActive = true }) {
  const [questions, setQuestions] = useState(() => initialQuestions);
  const [orders, setOrders] = useState(() => optionOrders(initialQuestions));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [locked, setLocked] = useState({});
  const sessionId = useRef(`mistakes-${crypto.randomUUID()}`);
  const startedAt = useRef(Date.now());
  const question = questions[index];
  const selection = answers[question?.id] || [];
  const isLocked = Boolean(locked[question?.id]);
  const complete = questions.length > 0 && questions.every(item => locked[item.id]);
  const remainingWrong = questions.filter(item => locked[item.id] && !isCorrect(item, answers[item.id]));

  const choose = option => {
    if (isLocked || complete) return;
    document.activeElement?.blur?.();
    setAnswers(previous => ({
      ...previous,
      [question.id]: correctOptions(question).length > 1
        ? selection.includes(option) ? selection.filter(value => value !== option) : [...selection, option]
        : [option],
    }));
  };
  const submit = () => {
    if (isLocked || !selection.length || complete) return;
    document.activeElement?.blur?.();
    onAnswer?.(question, Array.isArray(question.correct) ? selection : selection[0], {
      sessionId: sessionId.current,
      timeTakenMs: Date.now() - startedAt.current,
    });
    setLocked(previous => ({ ...previous, [question.id]: true }));
  };
  const next = () => {
    if (!isLocked || index >= questions.length - 1) return;
    startedAt.current = Date.now();
    setIndex(value => value + 1);
  };
  const retryRemaining = () => {
    setQuestions(remainingWrong);
    setOrders(optionOrders(remainingWrong));
    setIndex(0);
    setAnswers({});
    setLocked({});
    sessionId.current = `mistakes-${crypto.randomUUID()}`;
    startedAt.current = Date.now();
  };

  useWindowKeydown(event => {
    if (!isActive || event.ctrlKey || event.metaKey || event.altKey || event.repeat ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName) || event.target?.isContentEditable || complete || !question) return;
    if (/^[1-9]$/.test(event.key)) {
      const option = orders[question.id][Number(event.key) - 1];
      if (option !== undefined) { event.preventDefault(); choose(option); }
    } else if (event.key === 'Enter' && event.target?.tagName !== 'BUTTON') {
      event.preventDefault();
      if (isLocked) next(); else submit();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault(); next();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault(); setIndex(value => value - 1);
    }
  });

  if (complete) {
    return <div className="results written-results">
      <h2>Αποτελέσματα επανάληψης</h2>
      <p>{title}</p>
      <div className="results-score">{questions.length - remainingWrong.length}/{questions.length}</div>
      <p>{remainingWrong.length ? `${remainingWrong.length} λάθη χρειάζονται ακόμη επανάληψη.` : 'Όλες οι απαντήσεις σωστές!'}</p>
      <div className="results-actions">
        {remainingWrong.length > 0 && <button type="button" className="results-btn primary" onClick={retryRemaining}>
          Επανάληψη των υπόλοιπων {remainingWrong.length} λαθών
        </button>}
        <button type="button" className="results-btn" onClick={onBack}>Επιστροφή στο αρχικό τεστ</button>
      </div>
    </div>;
  }

  if (!question) return null;
  return <div className="structured-mcq wrong-answer-practice">
    <button type="button" className="back-link" onClick={onBack}><Icons.ChevronLeft /> Επιστροφή στο αρχικό τεστ</button>
    <h2>Εξάσκηση μόνο των λαθών</h2>
    <p className="sheet-sub">{title} · Ερώτηση {index + 1}/{questions.length}</p>
    {context && <div className="vignette-text">{context}</div>}
    <div className="structured-card">
      <div className="question-stem">{question.stem || question.question || question.prompt}</div>
      {correctOptions(question).length > 1 && <p className="structured-instruction">Επίλεξε όλες τις σωστές απαντήσεις.</p>}
      <div className="options-list">
        {orders[question.id].map((option, displayIndex) => {
          const selected = selection.includes(option);
          const correct = correctOptions(question).includes(option);
          const stateClass = isLocked ? correct ? ' correct' : selected ? ' incorrect' : '' : selected ? ' selected' : '';
          return <button key={option} type="button" className={`option-btn${stateClass}`} disabled={isLocked}
            aria-pressed={selected} onClick={() => choose(option)}>
            <span className="option-letter" aria-hidden="true">{String.fromCharCode(913 + displayIndex)}</span>
            <span>{question.options[option]}</span>
          </button>;
        })}
      </div>
      {isLocked && <div className="explanation-box"><strong>{isCorrect(question, selection) ? 'Σωστό' : 'Επανάληψη'}</strong>{question.explanation || question.answer}</div>}
      <div className="structured-actions">
        <button type="button" className="nav-btn" aria-label="Προηγούμενη ερώτηση" disabled={index === 0} onClick={() => setIndex(value => value - 1)}><Icons.ChevronLeft /></button>
        {!isLocked && <button type="button" className="nav-btn primary" disabled={!selection.length} onClick={submit}><Icons.Lock /> Καταχώρηση</button>}
        <button type="button" className="nav-btn" disabled={!isLocked || index === questions.length - 1} onClick={next}>Επόμενη <Icons.ChevronRight /></button>
      </div>
    </div>
  </div>;
}
