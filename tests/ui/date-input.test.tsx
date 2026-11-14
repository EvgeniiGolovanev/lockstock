import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DateInput } from "@/components/date-input";

afterEach(cleanup);

function Field({ initial = "2026-11-14", includeTime = false, changed = () => {} }: {
  initial?: string; includeTime?: boolean; changed?: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return <label>Date<DateInput value={value} includeTime={includeTime} onValueChange={next => { setValue(next); changed(next); }} /></label>;
}

it("displays the requested mask and formats an existing ISO date", () => {
  render(<Field />);
  expect(screen.getByRole("textbox")).toHaveValue("14-Nov-2026");
  expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "dd-mmm-yyyy");
});

it("accepts a typed date and emits ISO without timezone conversion", () => {
  const changed = vi.fn();
  render(<Field changed={changed} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "03-feb-2028" } });
  expect(changed).toHaveBeenLastCalledWith("2028-02-03");
  fireEvent.blur(screen.getByRole("textbox"));
  expect(screen.getByRole("textbox")).toHaveValue("03-Feb-2028");
});

it("rejects impossible dates and clears the previous committed date", () => {
  const changed = vi.fn();
  render(<Field changed={changed} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "29-Feb-2027" } });
  expect(changed).toHaveBeenLastCalledWith("");
  expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  expect(screen.getByRole("textbox")).toHaveValue("29-Feb-2027");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "29-Feb-2028" } });
  expect(changed).toHaveBeenLastCalledWith("2028-02-29");
});

it("updates the visible date when selected through the native calendar", () => {
  const { container } = render(<Field />);
  fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: "2027-01-02" } });
  expect(screen.getByRole("textbox")).toHaveValue("02-Jan-2027");
});

it("preserves time in local date-time fields", () => {
  const changed = vi.fn();
  render(<Field initial="2026-11-14T09:30" includeTime changed={changed} />);
  expect(screen.getByRole("textbox")).toHaveValue("14-Nov-2026 09:30");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "15-Nov-2026 17:45" } });
  expect(changed).toHaveBeenLastCalledWith("2026-11-15T17:45");
});

it("uses the mask for an empty field and lets the user clear a date", () => {
  const changed = vi.fn();
  render(<Field initial="" changed={changed} />);
  expect(screen.getByRole("textbox")).toHaveValue("");
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "01-Jan-2027" } });
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
  expect(changed).toHaveBeenLastCalledWith("");
  expect(screen.getByRole("textbox")).not.toHaveAttribute("aria-invalid", "true");
});
