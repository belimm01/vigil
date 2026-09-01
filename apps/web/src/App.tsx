import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.js";
import { useAuth } from "./context/auth.js";
import { OrgProvider } from "./context/org.js";
import { Alerts } from "./pages/Alerts.js";
import { Login } from "./pages/Login.js";
import { MonitorDetail } from "./pages/MonitorDetail.js";
import { Overview } from "./pages/Overview.js";

export function App() {
  const { authed } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={authed ? <Navigate to="/" replace /> : <Login />} />
      <Route
        element={
          authed ? (
            <OrgProvider>
              <AppShell />
            </OrgProvider>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route index element={<Overview />} />
        <Route path="monitors/:id" element={<MonitorDetail />} />
        <Route path="alerts" element={<Alerts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
