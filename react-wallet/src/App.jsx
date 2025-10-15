import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import Home from "./pages/Home";
import JukeboxHome from "./pages/JukeboxHome";
import JukeboxDetail from "./pages/JukeboxDetail";
import "./flow/config";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="jukebox" element={<JukeboxHome />} />
          <Route path="jukebox/:code" element={<JukeboxDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
