// Only **emphasis** is interpreted; clinical text is never rendered as HTML.
function Emphasis({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : part
  );
}

export default function BoardRevisionNotes({ notes }) {
  return <div className="board-revision-notes">
    <p className="board-revision-label">Σημειώσεις μελέτης & επανάληψης</p>
    {notes.sections.map(section => <section key={section.title} className="board-revision-section">
      <h5>{section.title}</h5>
      <ul>{section.items.map((text, index) => <li key={index}><Emphasis text={text} /></li>)}</ul>
    </section>)}
    <details className="board-revision-sources">
      <summary>Πηγές & διαγνωστικό πλαίσιο</summary>
      <p>Τα κριτήρια επισημαίνονται ανά ταξινόμηση. Οι θεραπευτικές οδηγίες αναφέρονται με τον φορέα τους· δεν υποκαθιστούν την τοπική πρακτική ή την πληροφορία προϊόντος.</p>
      <ul>{notes.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
    </details>
  </div>;
}
