import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./Icons.jsx";
import { SCOPES, getSearchIndex, searchIndex } from "../lib/searchIndex.js";

/**
 * One search across every corpus in the product — MCQs, oral questions,
 * crucial questions, SOS material and reference boxes — reachable from
 * anywhere with Ctrl/⌘K.
 *
 * Retrieval speed is the product's second priority; before this, finding a
 * topic meant navigating to the screen that owned it first.
 */
export default function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState("idle");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setActive(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || items || status === "loading") return;
    setStatus("loading");
    getSearchIndex()
      .then(built => {
        setItems(built);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [open, items, status]);

  const results = useMemo(() => {
    if (!items) return [];
    return searchIndex(items, query, scope);
  }, [items, query, scope]);

  useEffect(() => setActive(0), [query, scope]);

  useEffect(() => {
    if (!listRef.current) return;
    const node = listRef.current.querySelector('[data-active="true"]');
    node?.scrollIntoView({ block: "nearest" });
  }, [active, results]);

  const choose = useCallback(
    item => {
      if (!item) return;
      onNavigate(item);
      onClose();
      setQuery("");
    },
    [onNavigate, onClose]
  );

  const onKeyDown = useCallback(
    event => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive(current => (results.length ? (current + 1) % results.length : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive(current => (results.length ? (current - 1 + results.length) % results.length : 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        choose(results[active]);
      }
    },
    [results, active, choose, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="palette-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Αναζήτηση υλικού μελέτης"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="palette" onKeyDown={onKeyDown}>
        <div className="palette-input-row">
          <span aria-hidden="true" style={{ color: "var(--ink-3)", display: "flex" }}>
            <Icons.Search />
          </span>
          <input
            ref={inputRef}
            type="search"
            className="palette-input"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Αναζήτηση σε όλο το υλικό…"
            aria-label="Αναζήτηση σε όλο το υλικό μελέτης"
            autoComplete="off"
            spellCheck="false"
          />
          <button type="button" className="btn btn-quiet btn-sm" onClick={onClose}>
            Κλείσιμο
          </button>
        </div>

        <div className="palette-scope" role="group" aria-label="Φίλτρο ενότητας">
          {SCOPES.map(option => (
            <button
              key={option.id}
              type="button"
              className="palette-scope-btn"
              aria-pressed={scope === option.id}
              onClick={() => setScope(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="palette-results" ref={listRef}>
          {status === "loading" && !items && (
            <p className="palette-empty" role="status">
              Φόρτωση ευρετηρίου…
            </p>
          )}
          {status === "error" && (
            <p className="palette-empty" role="alert">
              Δεν φορτώθηκε το ευρετήριο. Δοκίμασε ξανά.
            </p>
          )}
          {items && query.trim().length < 2 && (
            <p className="palette-empty">Γράψε τουλάχιστον δύο χαρακτήρες.</p>
          )}
          {items && query.trim().length >= 2 && results.length === 0 && (
            <p className="palette-empty">Καμία αντιστοίχιση για «{query}».</p>
          )}
          {results.map((item, index) => (
            <button
              key={`${item.scope}-${item.path}-${index}`}
              type="button"
              className="palette-item"
              data-active={index === active}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(item)}
            >
              <span className="stencil">{item.kind}</span>
              <span className="palette-item-title">{item.title}</span>
              {item.meta ? <span className="palette-item-meta">{item.meta}</span> : <span />}
            </button>
          ))}
        </div>

        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> πλοήγηση
          </span>
          <span>
            <span className="kbd">Enter</span> άνοιγμα
          </span>
          <span>
            <span className="kbd">Esc</span> κλείσιμο
          </span>
          {items ? <span style={{ marginLeft: "auto" }}>{items.length} καταχωρίσεις</span> : null}
        </div>
      </div>
    </div>
  );
}
