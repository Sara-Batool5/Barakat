import { lazy, useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth, type Role } from "./auth/AuthContext";
import { useLang } from "./i18n/LanguageContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import AppShell from "./pages/AppShell";

// The map library is large, so it loads only when someone opens the map.
const Overview = lazy(() => import("./pages/app/Overview"));
const NewSurplus = lazy(() => import("./pages/app/NewSurplus"));
const MyBatches = lazy(() => import("./pages/app/MyBatches"));
const Jobs = lazy(() => import("./pages/app/Jobs"));
const ReviewQueue = lazy(() => import("./pages/app/ReviewQueue"));
const Activity = lazy(() => import("./pages/app/Activity"));
const Impact = lazy(() => import("./pages/app/Impact"));
const MyFridge = lazy(() => import("./pages/app/MyFridge"));
const LiveMap = lazy(() => import("./pages/app/LiveMap"));

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
          <Route path="jobs" element={<RoleOnly roles={["volunteer"]}><Jobs /></RoleOnly>} />
          <Route path="review" element={<RoleOnly roles={["coordinator"]}><ReviewQueue /></RoleOnly>} />
          <Route path="activity" element={<RoleOnly roles={["coordinator"]}><Activity /></RoleOnly>} />
          <Route path="map" element={<RoleOnly roles={["volunteer", "coordinator", "fridge_host"]}><LiveMap /></RoleOnly>} />
          <Route path="impact" element={<RoleOnly roles={["restaurant", "coordinator"]}><Impact /></RoleOnly>} />
          <Route path="fridge" element={<RoleOnly roles={["fridge_host"]}><MyFridge /></RoleOnly>} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
