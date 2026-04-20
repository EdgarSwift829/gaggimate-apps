import { useState } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Brewing from "./pages/Brewing";
import ShotResult from "./pages/ShotResult";
import RecipesPage from "./pages/Recipes";
import LogPage from "./pages/Log";
import SettingsPage from "./pages/Settings";
import Dashboard from "./pages/Dashboard";
import Compare from "./pages/Compare";
import Trends from "./pages/Trends";
import RecipeAI from "./pages/RecipeAI";
import MobileConnect from "./pages/MobileConnect";
import "./App.css";

const NAV_ITEMS: { to: string; icon: string; label: string; end?: boolean }[] = [
  { to: "/", icon: "🏠", label: "ホーム", end: true },
  { to: "/recipes", icon: "📋", label: "レシピ" },
  { to: "/log", icon: "📊", label: "ログ" },
  { to: "/dashboard", icon: "📈", label: "分析" },
  { to: "/recipe-ai", icon: "🤖", label: "AI" },
  { to: "/mobile", icon: "📱", label: "スマホ" },
  { to: "/settings", icon: "⚙️", label: "設定" },
];

function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <BrowserRouter>
      <div className="app">
        <nav className={`sidebar${collapsed ? " collapsed" : ""}`}>
          <h2 onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? "≡" : "GaggiMate"}
          </h2>
          {NAV_ITEMS.map(({ to, icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={(e) => {
                if (collapsed) {
                  e.preventDefault();
                  setCollapsed(false);
                } else {
                  setCollapsed(true);
                }
              }}
            >
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/brewing" element={<Brewing />} />
            <Route path="/shot/:id" element={<ShotResult />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/log" element={<LogPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/recipe-ai" element={<RecipeAI />} />
            <Route path="/mobile" element={<MobileConnect />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
