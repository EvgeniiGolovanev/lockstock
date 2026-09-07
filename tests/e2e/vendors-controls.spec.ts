import { expect, test } from "@playwright/test";

test("vendors page has one set of filters and management actions", async ({ page }) => {
  await page.goto("/vendors?demo=1");
  await expect(page.getByRole("heading", { name: "Vendors", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vendor Management", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Add Vendor", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toHaveCount(1);
  await expect(page.locator(".search-input-wrap input")).toHaveCount(1);
  await expect(page.locator(".category-wrap select")).toHaveCount(1);
  await page.locator(".search-input-wrap input").fill("no-matching-vendor-123");
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeDisabled();
  await page.locator(".search-input-wrap input").fill("");
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeEnabled();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("vendors.csv");
  await page.getByRole("button", { name: "Add Vendor", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Add vendor", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Add Vendor", exact: true })).toBeVisible();
  await expect(page.locator(".search-input-wrap input")).toHaveCount(1);
});
