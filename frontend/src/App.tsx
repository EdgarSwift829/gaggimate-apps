import { useState, useRef } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Brewing from "./pages/Brewing";
import ShotResult from "./pages/ShotResult";
import RecipesPage from "./pages/Recipes";
import RecipeEditor from "./pages/RecipeEditor";
import LogPage from "./pages/Log";
import SettingsPage from "./pages/Settings";
import Dashboard from "./pages/Dashboard";
import Compare from "./pages/Compare";
import Trends from "./pages/Trends";
import RecipeAI from "./pages/RecipeAI";
import MobileConnect from "./pages/MobileConnect";
import "./App.css";

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "ホーム", end: true },
  { to: "/recipes", label: "レシピ" },
  { to: "/log", label: "ログ" },
  { to: "/dashboard", label: "分析" },
  { to: "/recipe-ai", label: "AI レシピ" },
  { to: "/mobile", label: "スマホ連携" },
  { to: "/settings", label: "設定" },
];

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const touchStartX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) return; // ignore pinch
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length > 1) return; // ignore pinch
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (collapsed && touchStartX.current < 40 && deltaX > 50) {
      setCollapsed(false);
    }
  };

  return (
    <BrowserRouter>
      <div
        className="app"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <nav className={`sidebar${collapsed ? " collapsed" : ""}`}>
          {collapsed ? (
            <div className="sidebar-strip" onClick={() => setCollapsed(false)}>
              ›
            </div>
          ) : (
            <>
              <h2>GaggiMate</h2>
              {NAV_ITEMS.map(({ to, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setCollapsed(true)}
                >
                  {label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <main
          className="content"
          onClick={(e) => { if (e.target === e.currentTarget && !collapsed) setCollapsed(true); }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/brewing" element={<Brewing />} />
            <Route path="/shot/:id" element={<ShotResult />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipe-editor" element={<RecipeEditor />} />
            <Route path="/recipe-editor/:id" element={<RecipeEditor />} />
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
