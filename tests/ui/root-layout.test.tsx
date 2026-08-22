import { describe, expect, it } from "vitest";

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("does not suppress hydration warnings after removing the locale bootstrap script", () => {
    const layout = RootLayout({ children: <main>LockStock</main> });

    expect(layout.props.suppressHydrationWarning).toBeUndefined();
  });
});
