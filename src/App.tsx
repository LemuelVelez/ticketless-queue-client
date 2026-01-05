// src/App.tsx
import * as React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  Outlet,
} from "react-router-dom";

function Layout() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <NavLink to="/" className="font-semibold tracking-tight">
            My App
          </NavLink>

          <nav className="flex items-center gap-2">
            <NavItem to="/">Home</NavItem>
            <NavItem to="/docs">Docs</NavItem>
            <NavItem to="/settings">Settings</NavItem>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted-foreground">
          © {new Date().getFullYear()} My App
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "rounded-md px-3 py-1.5 text-sm transition",
          "hover:bg-accent hover:text-accent-foreground",
          isActive ? "bg-primary text-primary-foreground" : "text-foreground",
        ].join(" ")
      }
      end={to === "/"}
    >
      {children}
    </NavLink>
  );
}

function HomePage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Home</h1>
      <p className="text-muted-foreground">
        React Router is working. Your teal theme is coming from CSS variables in{" "}
        <code className="rounded bg-muted px-1 py-0.5">src/index.css</code>.
      </p>

      <div className="rounded-lg border p-4">
        <div className="mb-2 font-medium">Quick links</div>
        <div className="flex flex-wrap gap-2">
          <NavLink
            to="/docs"
            className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Go to Docs
          </NavLink>
          <NavLink
            to="/settings"
            className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Go to Settings
          </NavLink>
        </div>
      </div>
    </div>
  );
}

function DocsPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Docs</h1>
      <p className="text-muted-foreground">
        Replace these pages with your real components whenever you’re ready.
      </p>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-muted-foreground">
        This is a placeholder route:{" "}
        <code className="rounded bg-muted px-1 py-0.5">/settings</code>
      </p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-muted-foreground">Page not found.</p>
      <NavLink
        to="/"
        className="inline-flex rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
      >
        Back to Home
      </NavLink>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Optional: redirect example */}
          <Route path="/home" element={<Navigate to="/" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
