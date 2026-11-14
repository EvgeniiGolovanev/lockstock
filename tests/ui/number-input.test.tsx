import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { NumberInput } from "@/components/number-input";

afterEach(cleanup);

function Field({ min, max, disabled = false }: { min?: number; max?: number; disabled?: boolean }) {
  const [value, setValue] = useState("2.5");
  return <label>Quantity<NumberInput value={value} onValueChange={setValue} min={min} max={max} disabled={disabled} /></label>;
}

it("changes a fractional value by exactly one with both arrow buttons", () => {
  render(<Field />);
  fireEvent.click(screen.getByRole("button", { name: "+1" }));
  expect(screen.getByRole("spinbutton")).toHaveValue(3.5);
  fireEvent.click(screen.getByRole("button", { name: "−1" }));
  expect(screen.getByRole("spinbutton")).toHaveValue(2.5);
});

it("uses the same unit step for keyboard arrows without snapping decimals", () => {
  render(<Field min={0.001} />);
  const input = screen.getByRole("spinbutton");
  fireEvent.keyDown(input, { key: "ArrowUp" });
  expect(input).toHaveValue(3.5);
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(input).toHaveValue(2.5);
});

it("accepts manually entered decimals without a step mismatch", () => {
  render(<Field />);
  const input = screen.getByRole("spinbutton") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "0.125" } });
  expect(input).toHaveValue(0.125);
  expect(input.validity.stepMismatch).toBe(false);
  fireEvent.keyDown(input, { key: "ArrowUp" });
  expect(input).toHaveValue(1.125);
});

it("does not cross bounds or replace a unit step with a fractional step", () => {
  render(<Field min={2} max={3} />);
  expect(screen.getByRole("button", { name: "+1" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "−1" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "ArrowUp" });
  expect(screen.getByRole("spinbutton")).toHaveValue(2.5);
});

it("does not change a disabled field", () => {
  render(<Field disabled />);
  expect(screen.getByRole("button", { name: "+1" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("spinbutton"), { key: "ArrowDown" });
  expect(screen.getByRole("spinbutton")).toHaveValue(2.5);
});
