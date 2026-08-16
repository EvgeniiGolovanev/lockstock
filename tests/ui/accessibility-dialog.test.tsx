import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { AccessibilityDialog } from "@/components/accessibility-dialog";

function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>

      {open ? (
        <AccessibilityDialog title="Edit location" onClose={() => setOpen(false)}>
          <label>
            Location name
            <input data-dialog-initial-focus />
          </label>
          <button type="button">Save</button>
        </AccessibilityDialog>
      ) : null}
    </div>
  );
}

test("focuses the initial control, traps Tab, closes on Escape, and restores focus", () => {
  render(<Harness />);

  const trigger = screen.getByRole("button", { name: "Open dialog" });
  trigger.focus();
  fireEvent.click(trigger);

  const dialog = screen.getByRole("dialog", { name: "Edit location" });
  const input = screen.getByRole("textbox", { name: "Location name" });
  const save = screen.getByRole("button", { name: "Save" });
  const close = screen.getByRole("button", { name: "Close dialog" });

  expect(input).toHaveFocus();

  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(save).toHaveFocus();

  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(close).toHaveFocus();

  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(input).toHaveFocus();

  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog", { name: "Edit location" })).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});
