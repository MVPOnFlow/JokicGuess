import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Home from "./pages/Home";
import Swapfest from "./pages/Swapfest";
import Treasury from "./pages/Treasury";
import Vote from "./pages/Vote";
import Fastbreak from "./pages/Fastbreak";
import HorseStats from "./pages/HorseStats";
import TDWatch from "./pages/TDWatch";
import BlogList from "./pages/blog/BlogList";
import OKCGameAnalysis from "./pages/blog/OKCGameAnalysis";
import TripleDoubleChase from "./pages/blog/TripleDoubleChase";
import FlowSecurityIncident from './pages/blog/FlowSecurityIncident';
import "./flow/config";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="swapfest" element={<Swapfest />} />
          <Route path="treasury" element={<Treasury />} />
          <Route path="vote" element={<Vote />} />
          <Route path="fastbreak" element={<Fastbreak />} />
          <Route path="horsestats" element={<HorseStats />} />
          <Route path="tdwatch" element={<TDWatch />} />
          <Route path="blog" element={<BlogList />} />
          <Route path="blog/okc-game-analysis" element={<OKCGameAnalysis />} />
          <Route path="blog/triple-double-chase" element={<TripleDoubleChase />} />
          <Route path="blog/flow-security-incident" element={<FlowSecurityIncident />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
