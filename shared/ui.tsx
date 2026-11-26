import type { ReactNode } from "react";

export function Layout({
  section,
  nav,
  children,
}: {
  section: string;
  nav: { href: string; label: string; current?: boolean }[];
  children: ReactNode;
}) {
  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <a className="brand" href="/" aria-label="Northcrest Air home">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <path d="M3 22 L16 6 L29 22 L22 22 L16 14 L10 22 Z" fill="currentColor" />
              <path d="M8 26 H24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <span>
              Northcrest <b>Air</b>
            </span>
          </a>
          <span className="section">{section}</span>
          <nav aria-label="Main">
            {nav.map((n) => (
              <a key={n.href} href={n.href} aria-current={n.current ? "page" : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        Northcrest Air is a fictional airline: a live demonstration of cloud monitoring. No real flights are sold.
      </footer>
    </>
  );
}

export function Notice({ kind = "error", children }: { kind?: "error" | "info" | "success"; children: ReactNode }) {
  return (
    <div className={`notice notice-${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

/** Navigate within the single-page app without a reload. */
export function go(path: string) {
  history.pushState(null, "", path);
  dispatchEvent(new PopStateEvent("popstate"));
}
