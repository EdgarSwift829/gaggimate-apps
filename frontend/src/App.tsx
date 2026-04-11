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
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="sidebar">
          <h2>GaggiMate</h2>
          <NavLink to="/">ホーム</NavLink>
          <NavLink to="/recipes">レシピ</NavLink>
          <NavLink to="/log">ログ</NavLink>
          <NavLink to="/dashboard">分析</NavLink>
          <NavLink to="/recipe-ai">AI レシピ</NavLink>
          <NavLink to="/settings">設定</NavLink>
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
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
