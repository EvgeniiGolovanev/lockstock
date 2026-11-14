"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import styles from "./date-input.module.css";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function displayDate(value: string, includeTime: boolean) {
  if (!value) return "";
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-");
  if (!months[Number(month) - 1]) return "";
  return `${day}-${months[Number(month) - 1]}-${year}${includeTime ? ` ${time?.slice(0, 5) ?? "00:00"}` : ""}`;
}

function parseDate(text: string, includeTime: boolean) {
  const match = /^(\d{2})-([a-z]{3})-(\d{4})(?: (\d{2}):(\d{2}))?$/i.exec(text);
  if (!match || (includeTime !== Boolean(match[4]))) return "";
  const [, day, monthName, year, hour, minute] = match;
  const month = months.findIndex(month => month.toLowerCase() === monthName.toLowerCase()) + 1;
  if (!month || Number(year) < 1 || Number(hour ?? 0) > 23 || Number(minute ?? 0) > 59) return "";
  const date = `${year}-${String(month).padStart(2, "0")}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return "";
  return includeTime ? `${date}T${hour}:${minute}` : date;
}

type DateInputProps = Omit<ComponentProps<"input">, "type" | "value" | "onChange" | "min" | "max"> & {
  value: string;
  onValueChange: (value: string) => void;
  onValidityChange?: (valid: boolean) => void;
  includeTime?: boolean;
  locale?: "en" | "fr";
  min?: string;
  max?: string;
};

export function DateInput({ value, onValueChange, onValidityChange, includeTime = false, locale = "en", min, max, disabled, readOnly, onBlur, ...props }: DateInputProps) {
  const calendar = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ value, text: displayDate(value, includeTime) });
  const text = draft.value === value ? draft.text : displayDate(value, includeTime);
  const parsedText = parseDate(text, includeTime);
  const invalid = text !== "" && (!parsedText || (min != null && parsedText < min) || (max != null && parsedText > max));
  useEffect(() => { onValidityChange?.(!invalid); }, [invalid, onValidityChange]);
  const select = (next: string) => {
    setDraft({ value: next, text: displayDate(next, includeTime) });
    onValueChange(next);
  };

  return <span className={styles.control}>
    <input {...props} type="text" value={text} placeholder={includeTime ? "dd-mmm-yyyy hh:mm" : "dd-mmm-yyyy"}
      disabled={disabled} readOnly={readOnly} aria-invalid={invalid ? true : props["aria-invalid"]}
      title={includeTime ? "dd-mmm-yyyy hh:mm" : "dd-mmm-yyyy"}
      onChange={event => {
        const text = event.target.value;
        const parsed = parseDate(text, includeTime);
        const next = parsed && (min == null || parsed >= min) && (max == null || parsed <= max) ? parsed : "";
        setDraft({ value: next, text });
        onValueChange(next);
      }}
      onBlur={event => {
        if (value && parseDate(text, includeTime)) setDraft({ value, text: displayDate(value, includeTime) });
        onBlur?.(event);
      }} />
    <button type="button" className={styles.calendarButton} disabled={disabled || readOnly}
      aria-label={locale === "fr" ? "Ouvrir le calendrier" : "Open calendar"}
      onClick={event => {
        event.preventDefault();
        if (calendar.current?.showPicker) calendar.current.showPicker();
        else calendar.current?.click();
      }}>
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" />
      </svg>
    </button>
    <input ref={calendar} className={styles.nativeCalendar} type={includeTime ? "datetime-local" : "date"}
      value={value} min={min} max={max} disabled={disabled || readOnly} tabIndex={-1} aria-hidden="true"
      onChange={event => select(event.target.value)} />
  </span>;
}
