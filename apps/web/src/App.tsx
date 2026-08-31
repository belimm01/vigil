import { useState } from "react";
import { getToken } from "./api.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Login } from "./pages/Login.js";

export function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));

  return authed ? <Dashboard onLogout={() => setAuthed(false)} /> : <Login onAuthed={() => setAuthed(true)} />;
}
