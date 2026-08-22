import { useEffect, useRef, useState } from "react";

/**
 * The signature object: a five-box anchored response row, drawn like a
 * clinical rating instrument's item scale. Boxes fill left to right as
 * mastery rises.
 *
 * Read-only by default. When `onSet` is supplied the boxes become the
 * control — you mark the box, exactly as you would on the paper sheet.
 *
 * Colour is never the only signal: the strip carries a text label.
 */

const LEVEL_LABEL = ["Καθόλου", "Ελάχιστα", "Μερικώς", "Σχεδόν", "Πλήρως"];

export default function ScaleStrip({
  level = 0,
  max = 5,
  size = "sm",
  onSet = null,
  label = "Επίπεδο κατοχής",
  className = "",
}) {
  const safeLevel = Math.max(0, Math.min(max, Math.round(Number(level) || 0)));
  const previous = useRef(safeLevel);
  const [justMarked, setJustMarked] = useState(-1);

  useEffect(() => {
    if (safeLevel > previous.current) {
      setJustMarked(safeLevel - 1);
      const timer = setTimeout(() => setJustMarked(-1), 260);
      previous.current = safeLevel;
      return () => clearTimeout(timer);
    }
    previous.current = safeLevel;
    return undefined;
  }, [safeLevel]);

  const anchor = LEVEL_LABEL[Math.min(safeLevel, LEVEL_LABEL.length - 1)] || "";
  const text = `${label}: ${safeLevel} από ${max}${anchor ? ` — ${anchor}` : ""}`;
  const classes = `scale${size === "lg" ? " scale-lg" : ""}${className ? ` ${className}` : ""}`;

  const boxes = Array.from({ length: max }, (_, index) => {
    const marked = index < safeLevel;
    const full = safeLevel >= max;
    const boxClass = [
      "scale-box",
      marked ? "is-marked" : "",
      marked && full ? "is-full" : "",
      index === justMarked ? "just-marked" : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (!onSet) return <span key={index} className={boxClass} />;

    const target = safeLevel === index + 1 ? index : index + 1;
    return (
      <button
        key={index}
        type="button"
        className={boxClass}
        aria-label={`Όρισε ${label.toLowerCase()} σε ${target} από ${max}`}
        onClick={event => {
          event.stopPropagation();
          onSet(target);
        }}
      />
    );
  });

  if (onSet) {
    return (
      <span className={classes} role="group" aria-label={text}>
        {boxes}
      </span>
    );
  }

  return (
    <span className={classes} role="img" aria-label={text} title={text}>
      {boxes}
    </span>
  );
}
