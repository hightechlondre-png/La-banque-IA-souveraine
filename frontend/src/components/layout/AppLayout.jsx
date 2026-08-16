import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import { useMemoryAlerts } from "@/hooks/useMemoryAlerts";
import { getToken } from "@/api/base44Client";
import SimulationPanel from "@/components/SimulationPanel";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import OnboardingTour from "@/components/onboarding/OnboardingTour";

const BACKEND =
  import.meta.env.REACT_APP_BACKEND_URL ||
  (typeof process !== "undefined" && process.env?.REACT_APP_BACKEND_URL) ||
  "";

export default function AppLayout() {
  useMemoryAlerts();
  const [user, setUser] = useState(null);

  useEffect(() => {
    axios
      .get(`${BACKEND}/api/auth/me`, { headers: { Authorization: `Bearer ${getToken()}` }, timeout: 8000 })
      .then((r) => setUser(r.data))
      .catch(() => {});
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 pb-24 overflow-auto">
          <Outlet />
        </main>
      </div>
      <SimulationPanel />
      {user && <OnboardingTour user={user} onComplete={() => setUser({ ...user, onboarding_completed: true })} />}
    </div>
  );
}