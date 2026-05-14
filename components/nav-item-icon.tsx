export type NavIcon =
  | "inventory"
  | "materials"
  | "stock-movements"
  | "locations"
  | "vendors"
  | "purchase-orders"
  | "members"
  | "workflows";

export function NavItemIcon({ icon }: { icon: NavIcon }) {
  if (icon === "inventory") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16M6 7V5h12v2M6 19v-2h12v2" />
      </svg>
    );
  }

  if (icon === "materials") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 4 7.2 12 11.4 20 7.2 12 3Zm-8 9L12 16l8-4M4 16l8 4 8-4" />
      </svg>
    );
  }

  if (icon === "stock-movements") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7h11m0 0-3-3m3 3-3 3M17 17H6m0 0 3 3m-3-3 3-3" />
      </svg>
    );
  }

  if (icon === "locations") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s6-5.4 6-10.5A6 6 0 1 0 6 10.5C6 15.6 12 21 12 21Zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </svg>
    );
  }

  if (icon === "vendors") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 20a4 4 0 0 0-8 0M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 8a4 4 0 0 0-3-3.9M17 11a2.5 2.5 0 1 0 0-5" />
      </svg>
    );
  }

  if (icon === "members") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 20a4 4 0 0 0-8 0M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 8a4 4 0 0 0-3-3.9M17 11a2.5 2.5 0 1 0 0-5M4 20a4 4 0 0 1 3-3.9M7 11a2.5 2.5 0 1 1 0-5" />
      </svg>
    );
  }

  if (icon === "workflows") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 5h5v5H5V5Zm9 0h5v5h-5V5ZM5 14h5v5H5v-5Zm9 2.5h5M16.5 14v5M10 7.5h4M7.5 10v4M17 10v4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h2l2 9h10l2-7H8M9 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm10 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" />
    </svg>
  );
}
