import { Icons } from "./Icons.jsx";

/**
 * Persistent thumb-index navigation, the way a formulary's edge tabs work.
 *
 * Replaces the per-screen «Πίσω / Αρχική» button pair: every section is one
 * interaction away from every other section, at every depth.
 * Desktop (≥900px) gets the rail; below that, a bottom tab bar in the thumb
 * zone plus a sticky top bar carrying the title and search.
 */

export const SECTIONS = [
  { id: "mcq", path: "/mcq", label: "Πολλαπλής", full: "Πολλαπλής Επιλογής", Icon: Icons.ClipboardCheck },
  { id: "oral", path: "/oral", label: "Προφορικά", full: "Προφορικά", Icon: Icons.Mic },
  { id: "sos", path: "/sos", label: "SOS", full: "SOS Ψυχιατρικής", Icon: Icons.Bolt },
  { id: "pinakakia", path: "/tables", label: "Πινακάκια", full: "Πινακάκια", Icon: Icons.Table },
];

function sectionFor(screen) {
  if (!screen) return null;
  if (screen === "mcq") return "mcq";
  if (screen === "pinakakia") return "pinakakia";
  if (screen.startsWith("oral")) return "oral";
  if (screen.startsWith("sos")) return "sos";
  return null;
}

export default function AppShell({
  screen,
  title,
  counts = {},
  profileName,
  isAdmin,
  theme,
  onToggleTheme,
  onNavigateSection,
  onOpenSearch,
  onOpenShortcuts,
  onSwitchProfile,
  onHome,
  children,
}) {
  const current = sectionFor(screen);

  return (
    <div className="app-shell">
      <nav className="rail" aria-label="Κύρια πλοήγηση">
        <div className="rail-mast">
          <button
            type="button"
            className="rail-mast-title"
            onClick={onHome}
            style={{ textAlign: "left", padding: 0 }}
          >
            Εξετάσεις Ειδικότητας
          </button>
          <span className="rail-mast-sub">Ψυχιατρική</span>
        </div>

        <button type="button" className="rail-search" onClick={onOpenSearch}>
          <Icons.Search />
          <span>Αναζήτηση υλικού</span>
          <span className="rail-search-key" aria-hidden="true">
            Ctrl K
          </span>
        </button>

        <div className="rail-group">
          <span className="rail-group-label" id="rail-sections">
            Ενότητες
          </span>
          <ul aria-labelledby="rail-sections">
            {SECTIONS.map(section => (
              <li key={section.id}>
                <button
                  type="button"
                  className="tab"
                  aria-current={current === section.id ? "page" : undefined}
                  onClick={() => onNavigateSection(section)}
                >
                  <section.Icon />
                  <span>{section.full}</span>
                  {counts[section.id] ? <span className="tab-count">{counts[section.id]}</span> : <span />}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rail-foot">
          <div className="rail-profile">
            <Icons.User />
            <span className="rail-profile-name">{profileName}</span>
            {isAdmin ? <span className="admin-badge">admin</span> : null}
          </div>
          <div style={{ display: "flex", gap: "var(--s1)", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-quiet btn-sm" onClick={onSwitchProfile}>
              Αλλαγή προφίλ
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm btn-icon"
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "Εναλλαγή σε φωτεινό θέμα" : "Εναλλαγή σε σκοτεινό θέμα"}
            >
              {theme === "dark" ? <Icons.Sun /> : <Icons.Moon />}
            </button>
            <button
              type="button"
              className="btn btn-quiet btn-sm btn-icon"
              onClick={onOpenShortcuts}
              aria-label="Συντομεύσεις πληκτρολογίου"
            >
              <Icons.Keyboard />
            </button>
          </div>
        </div>
      </nav>

      <div>
        <div className="topbar">
          <button
            type="button"
            className="btn btn-quiet btn-sm btn-icon"
            onClick={onHome}
            aria-label="Αρχική"
          >
            <Icons.Home />
          </button>
          <span className="topbar-title">{title}</span>
          <button
            type="button"
            className="btn btn-quiet btn-sm btn-icon"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Εναλλαγή σε φωτεινό θέμα" : "Εναλλαγή σε σκοτεινό θέμα"}
          >
            {theme === "dark" ? <Icons.Sun /> : <Icons.Moon />}
          </button>
          <button
            type="button"
            className="btn btn-quiet btn-sm btn-icon"
            onClick={onOpenSearch}
            aria-label="Αναζήτηση υλικού"
          >
            <Icons.Search />
          </button>
        </div>

        <main id="main-content" tabIndex={-1}>
          {/* Home renders its own visible <h1>; every other screen leads with
              an <h2>, so the shell supplies the page heading for assistive
              technology without changing the visual hierarchy. */}
          {screen !== "home" && <h1 className="sr-only">{title}</h1>}
          {children}
        </main>
      </div>

      <nav className="tabbar" aria-label="Ενότητες">
        {SECTIONS.map(section => (
          <button
            key={section.id}
            type="button"
            className="tabbar-btn"
            aria-current={current === section.id ? "page" : undefined}
            onClick={() => onNavigateSection(section)}
          >
            <section.Icon />
            <span>{section.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
