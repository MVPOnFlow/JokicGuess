import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Home from "./pages/Home";
import Swapfest from "./pages/Swapfest";
import Stables from "./pages/Stables";
import Treasury from "./pages/Treasury";
import Vote from "./pages/Vote";
import Fastbreak from "./pages/Fastbreak";
import HorseStats from "./pages/HorseStats";
import "./flow/config";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="swapfest" element={<Swapfest />} />
          <Route path="stables" element={<Stables />} />
          <Route path="treasury" element={<Treasury />} />
          <Route path="vote" element={<Vote />} />
          <Route path="fastbreak" element={<Fastbreak />} />
          <Route path="horsestats" element={<HorseStats />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
