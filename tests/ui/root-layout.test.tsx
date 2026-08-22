import { describe, expect, it } from "vitest";

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  it("tolerates the locale bootstrap script changing the html element before hydration", () => {
    const layout = RootLayout({ children: <main>LockStock</main> });

    expect(layout.props.suppressHydrationWarning).toBe(true);
  });
});
