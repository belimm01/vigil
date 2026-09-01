import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/auth.js";
import { useOrg } from "../context/org.js";
import { useTheme } from "../context/theme.js";
import { Icon } from "./Icon.js";

const links = [
  { to: "/", label: "Overview", icon: "grid" as const, end: true },
  { to: "/alerts", label: "Alerts", icon: "bell" as const, end: false },
];

export function AppShell() {
  const { orgs, orgId, setOrgId } = useOrg();
  const { theme, toggle } = useTheme();
  const { logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="brandmark">
            <Icon name="pulse" size={22} className="logo" />
            Vigil
          </span>
          <button
            className="btn ghost icon"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={18} />
          </button>
        </div>

        <nav className="nav">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon name={l.icon} size={18} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          {orgs.length > 0 && (
            <div className="orgswitch">
              <span className="field-label">Organization</span>
              {orgs.length > 1 ? (
                <select value={orgId ?? ""} onChange={(e) => setOrgId(e.target.value)}>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="user-row">
                  <span className="secondary">{orgs[0]!.name}</span>
                  <span className="badge neutral">{orgs[0]!.role}</span>
                </div>
              )}
            </div>
          )}
          <button className="btn ghost" onClick={logout} style={{ justifyContent: "flex-start" }}>
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
