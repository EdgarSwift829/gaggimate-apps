import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Brewing from "./pages/Brewing";
import ShotResult from "./pages/ShotResult";
import RecipesPage from "./pages/Recipes";
import LogPage from "./pages/Log";
import SettingsPage from "./pages/Settings";
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
          <NavLink to="/settings">設定</NavLink>
        </nav>
        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/brewing" element={<Brewing />} />
            <Route path="/shot/:id" element={<ShotResult />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/log" element={<LogPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
