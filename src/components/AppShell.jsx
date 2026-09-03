import { useEffect, useState } from "react";
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

const RAIL_COLLAPSED_KEY = "psych_rail_collapsed";

function sectionFor(screen) {
  if (!screen) return null;
  if (screen === "mcq") return "mcq";
  if (screen === "pinakakia") return "pinakakia";
  if (screen.startsWith("oral")) return "oral";
  if (screen.startsWith("sos")) return "sos";
  return null;
}

// Section identity colour, cascaded as --accent so the rail and the active
// screen pick up the same ink without every surface naming its own section.
const SECTION_ACCENT_VAR = {
  mcq: "--sec-mcq",
  oral: "--sec-oral",
  sos: "--sec-sos",
  pinakakia: "--sec-boxes",
};

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
  onOpenAdmin,
  children,
}) {
  const current = sectionFor(screen);
  const accentVar = SECTION_ACCENT_VAR[current] || null;
  const accentStyle = accentVar ? { "--accent": `var(${accentVar})`, "--accent-quiet": `var(${accentVar}-quiet)` } : undefined;

  // Purely presentational, persisted layout preference — kept local to the
  // shell rather than lifted to App state, same reasoning as the theme hook.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(RAIL_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(RAIL_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* layout preference just won't persist */
    }
  }, [collapsed]);

  return (
    <div className={`app-shell${collapsed ? " rail-collapsed" : ""}`} style={accentStyle}>
      <nav className="rail" aria-label="Κύρια πλοήγηση">
        <button
          type="button"
          className="rail-home"
          onClick={onHome}
          aria-label="Αρχική"
          title="Αρχική"
        >
          <Icons.Home />
          {!collapsed && <span>Αρχική</span>}
        </button>

        <div className="rail-group">
          {!collapsed && (
            <span className="rail-group-label" id="rail-sections">
              Ενότητες
            </span>
          )}
          <ul aria-labelledby={collapsed ? undefined : "rail-sections"}>
            {SECTIONS.map(section => (
              <li key={section.id}>
                <button
                  type="button"
                  className="tab"
                  style={{ "--tab-accent": `var(${SECTION_ACCENT_VAR[section.id]})` }}
                  aria-current={current === section.id ? "page" : undefined}
                  aria-label={collapsed ? section.full : undefined}
                  title={collapsed ? section.full : undefined}
                  onClick={() => onNavigateSection(section)}
                >
                  <section.Icon />
                  {!collapsed && <span>{section.full}</span>}
                  {!collapsed && (counts[section.id] ? <span className="tab-count">{counts[section.id]}</span> : <span />)}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {isAdmin && onOpenAdmin && (
          <div className="rail-group rail-admin">
            {!collapsed && <span className="rail-group-label">Διαχείριση</span>}
            <button
              type="button"
              className="tab"
              aria-label={collapsed ? "Επιλογές διαχειριστή" : undefined}
              title={collapsed ? "Επιλογές διαχειριστή" : undefined}
              onClick={onOpenAdmin}
            >
              <Icons.Settings />
              {!collapsed && <span>Επιλογές διαχειριστή</span>}
              {!collapsed && <span />}
            </button>
          </div>
        )}

        <div className="rail-foot">
          {collapsed ? (
            <button
              type="button"
              className="btn btn-quiet btn-sm btn-icon"
              onClick={onSwitchProfile}
              aria-label={`Αλλαγή προφίλ (${profileName})`}
              title={profileName}
            >
              <Icons.User />
            </button>
          ) : (
            <div className="rail-profile">
              <Icons.User />
              <span className="rail-profile-name">{profileName}</span>
              {isAdmin ? <span className="admin-badge">admin</span> : null}
            </div>
          )}
          <div className="rail-foot-actions">
            {!collapsed && (
              <button type="button" className="btn btn-quiet btn-sm" onClick={onSwitchProfile}>
                Αλλαγή προφίλ
              </button>
            )}
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
            <button
              type="button"
              className="btn btn-quiet btn-sm btn-icon"
              style={collapsed ? undefined : { marginLeft: "auto" }}
              onClick={() => setCollapsed(value => !value)}
              aria-label={collapsed ? "Ανάπτυξη πλαϊνής στήλης" : "Σύμπτυξη πλαϊνής στήλης"}
              title={collapsed ? "Ανάπτυξη" : "Σύμπτυξη"}
            >
              <Icons.PanelLeft />
            </button>
          </div>
        </div>
      </nav>

      <div>
        {!["home", "mcq", "oral", "sos", "pinakakia", "tables"].includes(screen) && (
          <div className="global-actions">
            <button
              type="button"
              className="global-action-btn"
              onClick={onHome}
              aria-label="Αρχική"
            >
              <Icons.Home />
            </button>
            <button
              type="button"
              className="global-action-btn"
              onClick={onOpenSearch}
              aria-label="Αναζήτηση υλικού"
            >
              <Icons.Search />
            </button>
          </div>
        )}

        <div className="topbar">
          <button
            type="button"
            className="btn btn-quiet btn-sm btn-icon"
            onClick={onHome}
            aria-label="Αρχική"
          >
            <Icons.Home />
          </button>
          <button
            type="button"
            className="topbar-profile"
            onClick={onSwitchProfile}
            aria-label={`Αλλαγή προφίλ. Τρέχον προφίλ: ${profileName}`}
          >
            <Icons.User />
            <span className="topbar-profile-copy">
              <span className="topbar-profile-name">{profileName}</span>
              <span className="topbar-profile-action">Αλλαγή προφίλ</span>
            </span>
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
