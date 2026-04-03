import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Brewing from "./pages/Brewing";
import PostShot from "./pages/PostShot";
import Recipes from "./pages/Recipes";
import Logs from "./pages/Logs";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/brewing" element={<Brewing />} />
          <Route path="/post-shot" element={<PostShot />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
