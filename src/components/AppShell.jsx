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
    <div className={`app-shell${collapsed ? " rail-collapsed" : ""}`}>
      <nav className="rail" aria-label="Κύρια πλοήγηση">
        <div className="rail-mast">
          {!collapsed && (
            <button
              type="button"
              className="rail-mast-title"
              onClick={onHome}
              style={{ textAlign: "left", padding: 0 }}
            >
              Εξετάσεις Ειδικότητας
            </button>
          )}
          <button
            type="button"
            className="rail-collapse-btn"
            onClick={() => setCollapsed(value => !value)}
            aria-label={collapsed ? "Ανάπτυξη πλαϊνής στήλης" : "Σύμπτυξη πλαϊνής στήλης"}
            title={collapsed ? "Ανάπτυξη" : "Σύμπτυξη"}
          >
            <Icons.PanelLeft />
          </button>
          {!collapsed && <span className="rail-mast-sub">Ψυχιατρική</span>}
        </div>

        <button
          type="button"
          className="rail-search"
          onClick={onOpenSearch}
          aria-label="Αναζήτηση υλικού"
        >
          <Icons.Search />
          {!collapsed && (
            <>
              <span>Αναζήτηση υλικού</span>
              <span className="rail-search-key" aria-hidden="true">
                Ctrl K
              </span>
            </>
          )}
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
