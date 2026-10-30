import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth, type Role } from "./auth/AuthContext";
import { useLang } from "./i18n/LanguageContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import AppShell from "./pages/AppShell";
import Overview from "./pages/app/Overview";
import ComingSoon from "./pages/app/ComingSoon";
import NewSurplus from "./pages/app/NewSurplus";
import MyBatches from "./pages/app/MyBatches";

function FullPageMessage() {
  const { t } = useLang();
  return (
    <div className="grid min-h-screen place-items-center bg-surface text-[13px] text-muted-foreground" role="status">
      {t.app.dash.loading}
    </div>
  );
}

/** Waits for the session, sends visitors to sign in, and unfinished accounts to onboarding. */
function RequireAuth({ children, ready = false }: { children: ReactNode; ready?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageMessage />;
  if (!user) return <Navigate to="/login" replace />;
  if (ready && user.needsOnboarding) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RoleOnly({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <Onboarding />
            </RequireAuth>
          }
        />
        <Route
          path="/app"
          element={
            <RequireAuth ready>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Overview />} />
          <Route path="new" element={<RoleOnly roles={["restaurant"]}><NewSurplus /></RoleOnly>} />
          <Route path="batches" element={<RoleOnly roles={["restaurant"]}><MyBatches /></RoleOnly>} />
          <Route path="jobs" element={<RoleOnly roles={["volunteer"]}><ComingSoon page="jobs" /></RoleOnly>} />
          <Route path="review" element={<RoleOnly roles={["coordinator"]}><ComingSoon page="review" /></RoleOnly>} />
          <Route path="map" element={<RoleOnly roles={["volunteer", "coordinator", "fridge_host"]}><ComingSoon page="map" /></RoleOnly>} />
          <Route path="impact" element={<RoleOnly roles={["restaurant", "coordinator"]}><ComingSoon page="impact" /></RoleOnly>} />
          <Route path="fridge" element={<RoleOnly roles={["fridge_host"]}><ComingSoon page="myFridge" /></RoleOnly>} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
