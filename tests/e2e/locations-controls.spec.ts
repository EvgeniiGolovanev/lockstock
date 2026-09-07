import { expect, test } from "@playwright/test";

test("location management actions open their dialogs on the Locations page", async ({ page }) => {
  await page.goto("/locations?demo=1");
  await page.getByRole("button", { name: "Add Location", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("textbox", { name: "Name", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Block", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
