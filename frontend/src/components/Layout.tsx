import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/", label: "ホーム", icon: "☕" },
  { to: "/recipes", label: "レシピ", icon: "📋" },
  { to: "/logs", label: "ログ", icon: "📊" },
  { to: "/settings", label: "設定", icon: "⚙" },
];

export default function Layout() {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <nav
        style={{
          width: 200,
          background: "#1a1a2e",
          color: "#fff",
          padding: "1rem 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "0 1rem 1.5rem",
            borderBottom: "1px solid #333",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>GaggiMate</h2>
          <small style={{ color: "#888" }}>Integration App</small>
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: "block",
              padding: "0.75rem 1rem",
              color: isActive ? "#fff" : "#aaa",
              background: isActive ? "#16213e" : "transparent",
              textDecoration: "none",
              borderLeft: isActive ? "3px solid #e94560" : "3px solid transparent",
            })}
          >
            {item.icon} {item.label}
          </NavLink>
        ))}
      </nav>
      <main style={{ flex: 1, padding: "1.5rem", background: "#0f0f23" }}>
        <Outlet />
      </main>
    </div>
  );
}
