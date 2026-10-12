import type { StudyPath, PathStrategy } from '../../learning/paths'
import { useI18n } from '../../i18n'

const modes: { id: PathStrategy; icon: string; en: string; el: string; enDetail: string; elDetail: string }[] = [
  { id: 'high', icon: '↑', en: 'High Yield First', el: 'Πρώτα τα σημαντικότερα', enDetail: 'Common exam domains first', elDetail: 'Προτεραιότητα στη βασική εξεταστέα ύλη' },
  { id: 'rare', icon: '◇', en: 'Rare & Obscure', el: 'Σπάνια και ιδιαίτερα', enDetail: 'Unusual syndromes and exceptions', elDetail: 'Σπάνια σύνδρομα και εξαιρέσεις' },
  { id: 'random', icon: '⤨', en: 'Randomized', el: 'Τυχαία σειρά', enDetail: 'A saved, shuffled route', elDetail: 'Μία αποθηκευμένη τυχαία διαδρομή' },
  { id: 'systematic', icon: '☷', en: 'Systematic', el: 'Συστηματικά', enDetail: 'Follow the curriculum', elDetail: 'Ακολούθησε τη σειρά της ύλης' },
  { id: 'weak', icon: '◎', en: 'Weak Areas', el: 'Αδύναμα σημεία', enDetail: 'Based on previous recall ratings', elDetail: 'Με βάση προηγούμενες αξιολογήσεις ανάκλησης' },
  { id: 'review', icon: '◷', en: 'Spaced Review', el: 'Διαστηματική επανάληψη', enDetail: 'Previously reviewed topics, oldest due first', elDetail: 'Παλαιότερες εκκρεμείς επαναλήψεις πρώτα' },
]
export function pathLabel(strategy: PathStrategy, locale: 'en' | 'el') {
  const mode = modes.find(m => m.id === strategy)
  return locale === 'el' ? mode?.el ?? strategy : mode?.en ?? strategy
}
export function PathsScreen({
  paths, onCreate, onSelect, onNew, choosing, onRename, onRestart, onDelete,
}: {
  paths: StudyPath[]
  onCreate: (strategy: PathStrategy) => void
  onSelect: (path: StudyPath) => void
  onNew: () => void
  choosing: boolean
  onRename: (path: StudyPath) => void
  onRestart: (path: StudyPath) => void
  onDelete: (path: StudyPath) => void
}) {
  const { locale } = useI18n()
  const greek = locale === 'el'
  const selectMode = choosing || paths.length === 0
  return <div className="page path-home">
    <div className="path-home__heading">
      <div className="path-home__symbol" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7a8 8 0 0 0-9-2v14a8 8 0 0 1 9 2"/><path d="M12 7a8 8 0 0 1 9-2v14a8 8 0 0 0-9 2"/><path d="M12 7v14"/></svg></div>
      <h1>{selectMode ? (greek ? 'Διάλεξε διαδρομή μελέτης' : 'Choose a Study Path')
        : (greek ? 'Οι διαδρομές σου' : 'Your Study Paths')}</h1>
      <p className="muted">{selectMode
        ? (greek ? 'Η ίδια ύλη και η ίδια πρόοδος, με διαφορετική σειρά.' : 'One curriculum and one learning history, approached in different ways.')
        : (greek ? 'Συνέχισε από εκεί που σταμάτησες.' : 'Pick up exactly where you left off.')}</p>
    </div>
    {selectMode ? <>
      <div className="path-mode-grid">
        {modes.map(mode => <button type="button" className="path-mode" key={mode.id} onClick={() => onCreate(mode.id)}>
          <span className="path-mode__icon" aria-hidden="true">{mode.icon}</span>
          <strong>{greek ? mode.el : mode.en}</strong>
          <small>{greek ? mode.elDetail : mode.enDetail}</small>
        </button>)}
      </div>
      {paths.length > 0 && <button type="button" className="utility-button path-back-home" onClick={onNew}>
        ← {greek ? 'Οι αποθηκευμένες διαδρομές' : 'Saved paths'}
      </button>}
      <p className="muted path-note">{greek
        ? 'Οι σειρές «Σημαντικότερα» και «Σπάνια» χρησιμοποιούν προσωρινούς κανόνες ταξινόμησης, όχι επιβεβαιωμένες συχνότητες εξετάσεων.'
        : 'High Yield and Rare currently use provisional editorial ordering, not verified exam-frequency labels.'}</p>
    </> : <>
      <div className="saved-paths">
        {paths.map(path => {
          const current = path.sequence[path.cursor]
          const mode = modes.find(m => m.id === path.strategy)
          return <section className="saved-path" key={path.id}>
            <button type="button" className="saved-path__resume" onClick={() => onSelect(path)}>
              <span className="saved-path__icon" aria-hidden="true">{mode?.icon}</span>
              <span className="saved-path__info">
                <strong>{path.name}</strong>
                <small>{path.visited.length} / {path.sequence.length} {greek ? 'θέματα στη διαδρομή' : 'topics visited'}</small>
                <span className="path-progress" aria-hidden="true"><span style={{width: (100 * path.visited.length / path.sequence.length) + '%'}} /></span>
                <small>{greek ? 'Συνέχεια:' : 'Next:'} {current} · {path.cursor + 1} / {path.sequence.length}</small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
            <div className="saved-path__actions">
              <button type="button" className="utility-button" onClick={() => onRename(path)}>{greek ? 'Μετονομασία' : 'Rename'}</button>
              <button type="button" className="utility-button" onClick={() => onRestart(path)}>{greek ? 'Από την αρχή' : 'Restart'}</button>
              <button type="button" className="utility-button" onClick={() => onDelete(path)}>{greek ? 'Διαγραφή' : 'Delete'}</button>
            </div>
          </section>
        })}
      </div>
      <button type="button" className="primary-button path-add" onClick={onNew}>＋ {greek ? 'Νέα διαδρομή' : 'Start a New Path'}</button>
    </>}
  </div>
}
