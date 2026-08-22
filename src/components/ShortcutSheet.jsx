const GROUPS = [
  {
    title: "Παντού",
    rows: [
      ["Ctrl K", "Αναζήτηση σε όλο το υλικό"],
      ["?", "Αυτός ο κατάλογος"],
      ["Esc", "Κλείσιμο"],
    ],
  },
  {
    title: "Ερωτήσεις πολλαπλής επιλογής",
    rows: [
      ["1 – 5", "Επιλογή απάντησης"],
      ["Enter", "Καταχώριση, μετά επόμενη"],
      ["→", "Επόμενη ερώτηση"],
      ["←", "Προηγούμενη ερώτηση"],
    ],
  },
  {
    title: "Προφορικά και SOS",
    rows: [
      ["Space", "Αποκάλυψη απάντησης"],
      ["→ / ←", "Επόμενο / προηγούμενο"],
    ],
  },
];

export default function ShortcutSheet({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Συντομεύσεις πληκτρολογίου"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={event => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="modal">
        <h3>Συντομεύσεις πληκτρολογίου</h3>
        {GROUPS.map(group => (
          <div key={group.title} style={{ display: "grid", gap: "var(--s2)" }}>
            <div className="subscale">
              <span className="subscale-title">{group.title}</span>
              <span className="subscale-rule" />
              <span />
            </div>
            {group.rows.map(([keys, label]) => (
              <div
                key={keys}
                style={{ display: "flex", justifyContent: "space-between", gap: "var(--s4)" }}
              >
                <span style={{ fontSize: "var(--t-meta)", color: "var(--ink-2)" }}>{label}</span>
                <span className="kbd">{keys}</span>
              </div>
            ))}
          </div>
        ))}
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" autoFocus onClick={onClose}>
            Εντάξει
          </button>
        </div>
      </div>
    </div>
  );
}
