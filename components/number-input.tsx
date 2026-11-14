"use client";

import { useRef, type ComponentProps } from "react";
import styles from "./number-input.module.css";

type NumberInputProps = Omit<ComponentProps<"input">, "type" | "step" | "onChange"> & {
  onValueChange: (value: string) => void;
};

export function NumberInput({ value, onValueChange, min, max, disabled, readOnly, onKeyDown, ...props }: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextValue = (direction: number) => {
    const current = value === "" || value == null ? 0 : Number(value);
    return Number((current + direction).toFixed(12));
  };
  const allowed = (direction: number) => {
    const next = nextValue(direction);
    return !disabled && !readOnly && Number.isFinite(next)
      && (min == null || next >= Number(min)) && (max == null || next <= Number(max));
  };
  const change = (direction: number) => {
    if (allowed(direction)) onValueChange(String(nextValue(direction)));
  };

  return <span className={styles.control}>
    <input {...props} ref={inputRef} type="number" step="any" value={value}
      min={min} max={max} disabled={disabled} readOnly={readOnly}
      onChange={event => onValueChange(event.target.value)}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
          change(event.key === "ArrowUp" ? 1 : -1);
        }
      }} />
    <span className={styles.arrows}>
      {[1, -1].map(direction => <button key={direction} type="button" tabIndex={-1}
        aria-label={direction === 1 ? "+1" : "−1"} disabled={!allowed(direction)}
        onClick={event => { event.preventDefault(); inputRef.current?.focus(); change(direction); }}>
        <svg aria-hidden="true" width="10" height="8" viewBox="0 0 10 8" fill="currentColor">
          <path d={direction === 1 ? "M5 2 9 6H1Z" : "M5 6 1 2H9Z"} />
        </svg>
      </button>)}
    </span>
  </span>;
}
