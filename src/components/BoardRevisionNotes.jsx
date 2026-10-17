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
      {section.paragraphs?.map((text, index) => <p key={index}><Emphasis text={text} /></p>)}
      {!!section.items?.length && <ul>{section.items.map((text, index) => <li key={index}><Emphasis text={text} /></li>)}</ul>}
      {section.table && <div className="board-revision-table-scroll" role="region" aria-label={section.title} tabIndex={0}>
        <table><thead><tr>{section.table.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{section.table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => cellIndex === 0
            ? <th key={cellIndex} scope="row"><Emphasis text={cell} /></th>
            : <td key={cellIndex}><Emphasis text={cell} /></td>)}</tr>)}</tbody>
        </table>
      </div>}
    </section>)}
    {!notes.hideSources && !!notes.sources?.length && <details className="board-revision-sources">
      <summary>Πηγές & διαγνωστικό πλαίσιο</summary>
      <p>Τα κριτήρια επισημαίνονται ανά ταξινόμηση. Οι θεραπευτικές οδηγίες αναφέρονται με τον φορέα τους· δεν υποκαθιστούν την τοπική πρακτική ή την πληροφορία προϊόντος.</p>
      <ul>{notes.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul>
    </details>}
  </div>;
}
