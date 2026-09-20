import { useMemo, useState } from "react";
import { Icons } from "./Icons.jsx";

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ");
}

const GROUPS = ["Όλα", "Αντιψυχωσικά", "Αντικαταθλιπτικά", "Σταθεροποιητές διάθεσης", "ADHD & άλλα"];

export default function Cyp450Tables({
  rows = [],
  enzymes = [],
  meta = {},
  mastered = {},
  onToggleMastery,
  onBack,
}) {
  const [tab, setTab] = useState("drugs");
  const [group, setGroup] = useState("Όλα");
  const [query, setQuery] = useState("");

  const visibleRows = useMemo(() => {
    const q = normalize(query).trim();
    return rows.filter(row => {
      if (group !== "Όλα" && row.group !== group) return false;
      if (!q) return true;
      return normalize([row.drug, row.group, row.metabolism, row.cypEffect, row.pearl].join(" ")).includes(q);
    });
  }, [group, query, rows]);

  const masteredCount = rows.reduce((sum, row) => sum + (mastered[row.id] ? 1 : 0), 0);

  return (
    <div className="sos-screen cyp450-screen">
      <div className="screen-topbar">
        <button className="back-link" onClick={onBack}>
          <Icons.ChevronLeft /> SOS
        </button>
      </div>

      <div className="sheet-head">
        <div className="sheet-head-text">
          <span className="sheet-eyebrow">SOS · Ψυχοφαρμακολογία</span>
          <h2>CYP450 & Ψυχιατρικά Φάρμακα</h2>
          <span className="sheet-sub">Κύριες μεταβολικές οδοί, inhibitors/inducers και εξεταστικές αλληλεπιδράσεις</span>
        </div>
        <div className="sheet-head-actions">
          <span className="plate">{masteredCount}/{rows.length} mastered</span>
        </div>
      </div>

      <div className="cyp450-note">
        <strong>Πώς να το διαβάζεις:</strong> η στήλη «Μεταβολισμός» δείχνει τις κύριες κλινικά σημαντικές οδούς, όχι κάθε minor in-vitro CYP.
        {" "}{meta.scopeNote}
        {meta.lastVerified && <span className="cyp450-verified"> Τελευταίος έλεγχος: {meta.lastVerified}.</span>}
      </div>

      <div className="cyp450-tabs" role="tablist" aria-label="Προβολή CYP450">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "drugs"}
          className={tab === "drugs" ? "active" : ""}
          onClick={() => setTab("drugs")}
        >
          Φάρμακα
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "enzymes"}
          className={tab === "enzymes" ? "active" : ""}
          onClick={() => setTab("enzymes")}
        >
          Ανά CYP ένζυμο
        </button>
      </div>

      {tab === "drugs" ? (
        <>
          <div className="cyp450-toolbar">
            <label className="cyp450-search">
              <span className="sr-only">Αναζήτηση φαρμάκου ή CYP</span>
              <Icons.Search />
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Αναζήτηση: clozapine, 2D6, 3A4, smoking…"
              />
            </label>
            <div className="cyp450-filters" aria-label="Κατηγορία φαρμάκων">
              {GROUPS.map(item => (
                <button
                  key={item}
                  type="button"
                  className={group === item ? "active" : ""}
                  onClick={() => setGroup(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="cyp450-table-wrap">
            <table className="cyp450-table">
              <thead>
                <tr>
                  <th>Φάρμακο</th>
                  <th>Κύριος μεταβολισμός</th>
                  <th>Επίδραση σε CYP</th>
                  <th>High-yield σημείο</th>
                  <th className="cyp450-master-col">✓</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <tr key={row.id} className={mastered[row.id] ? "mastered" : ""}>
                    <td>
                      <strong>{row.drug}</strong>
                      <span className="cyp450-group-label">{row.group}</span>
                    </td>
                    <td className="cyp450-pathway">{row.metabolism}</td>
                    <td>{row.cypEffect}</td>
                    <td>{row.pearl}</td>
                    <td className="cyp450-master-col">
                      <button
                        type="button"
                        className={mastered[row.id] ? "cyp450-master-btn active" : "cyp450-master-btn"}
                        aria-pressed={Boolean(mastered[row.id])}
                        aria-label={row.drug + ": " + (mastered[row.id] ? "αφαίρεση από mastered" : "σήμανση ως mastered")}
                        onClick={() => onToggleMastery?.(row.id, !mastered[row.id])}
                      >
                        <Icons.Check />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleRows.length && <div className="cyp450-empty">Δεν βρέθηκαν φάρμακα με αυτά τα φίλτρα.</div>}
          </div>
        </>
      ) : (
        <div className="cyp450-enzyme-grid">
          {enzymes.map(item => (
            <section className="cyp450-enzyme-card" key={item.enzyme}>
              <h3>{item.enzyme}</h3>
              <dl>
                <div>
                  <dt>Κύρια psychiatric substrates</dt>
                  <dd>{item.substrates}</dd>
                </div>
                <div>
                  <dt>Inhibitors</dt>
                  <dd>{item.inhibitors}</dd>
                </div>
                <div>
                  <dt>Inducers</dt>
                  <dd>{item.inducers}</dd>
                </div>
              </dl>
              <p className="cyp450-enzyme-pearl"><strong>SOS:</strong> {item.pearl}</p>
            </section>
          ))}
        </div>
      )}

      {meta.sourceNote && <p className="cyp450-source-note">{meta.sourceNote}</p>}
    </div>
  );
}
