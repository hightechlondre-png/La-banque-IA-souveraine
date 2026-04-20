import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Landing from './pages/Landing';
import PaymentSuccess from './pages/PaymentSuccess';
import PublicAudit from './pages/PublicAudit';
import Dashboard from './pages/Dashboard';
import Tokenomics from './pages/Tokenomics';
import Staking from './pages/Staking';
import Governance from './pages/Governance';
import WalletPage from './pages/WalletPage';
import Security from './pages/Security';
import AuditDS from './pages/AuditDS';
import Sentinel from './pages/Sentinel';
import NMemB from './pages/NMemB';
import NMemA from './pages/NMemA';
import GraphView from './pages/GraphView';
import AuditTrail from './pages/AuditTrail';
import AnalyticsReports from './pages/AnalyticsReports';
import FractalEngine from './pages/FractalEngine';
import GovernanceAI from './pages/GovernanceAI';
import StrategicRoadmap from './pages/StrategicRoadmap';
import SecurityAudit from './pages/SecurityAudit';
import FractalSim from './pages/FractalSim';
import PredictiveDashboard from './pages/PredictiveDashboard';
import ExecutiveReport from './pages/ExecutiveReport';
import QuantumAttackSim from './pages/QuantumAttackSim';
import ComplianceDashboard from './pages/ComplianceDashboard';
import NetworkStressSim from './pages/NetworkStressSim';
import PredictiveMaintenance from './pages/PredictiveMaintenance';
import IoTDataFlow from './pages/IoTDataFlow';
import ResourceDashboard from './pages/ResourceDashboard';
import TokenListing from './pages/TokenListing';
import DAOGovernance from './pages/DAOGovernance';
import SmartContractAudit from './pages/SmartContractAudit';
import ZKProofs from './pages/ZKProofs';
import AdvancedAnalytics from './pages/AdvancedAnalytics';
import BridgePage from './pages/BridgePage';
import AIAuditPage from './pages/AIAuditPage';
import LiquidityPage from './pages/LiquidityPage';
import UserAnalytics from './pages/UserAnalytics';
import SecurityScanner from './pages/SecurityScanner';
import CognitiveChat from './pages/CognitiveChat';
import AQDashboard from './pages/AQDashboard';
import HistoryPage from './pages/HistoryPage';
import TelegramAlertsSettings from './pages/TelegramAlertsSettings';
import AgentsOrchestrator from './pages/AgentsOrchestrator';
import AgentNetwork from './pages/AgentNetwork';
import SkillManager from './pages/SkillManager';
import DocumentIndexer from './pages/DocumentIndexer';
import AgentReports from './pages/AgentReports';
import SaasBrochure from './pages/SaasBrochure';
import SystemMonitor from './pages/SystemMonitor';

const RequireAuth = ({ children }) => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

// Root: authenticated → Dashboard, else → Landing
const RootRoute = () => {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Landing />;
};

const AuthenticatedApp = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/public-audit" element={<PublicAudit />} />
      <Route
        path="/payments/success"
        element={
          <RequireAuth>
            <PaymentSuccess />
          </RequireAuth>
        }
      />
      <Route path="/" element={<RootRoute />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tokenomics" element={<Tokenomics />} />
        <Route path="/staking" element={<Staking />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/security" element={<Security />} />
        <Route path="/audit-ds" element={<AuditDS />} />
        <Route path="/sentinel" element={<Sentinel />} />
        <Route path="/nmem-b" element={<NMemB />} />
        <Route path="/nmem-a" element={<NMemA />} />
        <Route path="/fractal-engine" element={<FractalEngine />} />
        <Route path="/graph-view" element={<GraphView />} />
        <Route path="/audit-trail" element={<AuditTrail />} />
        <Route path="/analytics" element={<AnalyticsReports />} />
        <Route path="/governance-ai" element={<GovernanceAI />} />
        <Route path="/strategic" element={<StrategicRoadmap />} />
        <Route path="/security-audit" element={<SecurityAudit />} />
        <Route path="/fractal-sim" element={<FractalSim />} />
        <Route path="/predictive" element={<PredictiveDashboard />} />
        <Route path="/executive" element={<ExecutiveReport />} />
        <Route path="/quantum-sim" element={<QuantumAttackSim />} />
        <Route path="/compliance" element={<ComplianceDashboard />} />
        <Route path="/stress" element={<NetworkStressSim />} />
        <Route path="/maintenance" element={<PredictiveMaintenance />} />
        <Route path="/iot" element={<IoTDataFlow />} />
        <Route path="/resources" element={<ResourceDashboard />} />
        <Route path="/listing" element={<TokenListing />} />
        <Route path="/dao" element={<DAOGovernance />} />
        <Route path="/contract-audit" element={<SmartContractAudit />} />
        <Route path="/zkp" element={<ZKProofs />} />
        <Route path="/advanced-analytics" element={<AdvancedAnalytics />} />
        <Route path="/bridge" element={<BridgePage />} />
        <Route path="/ai-audit" element={<AIAuditPage />} />
        <Route path="/liquidity" element={<LiquidityPage />} />
        <Route path="/user-analytics" element={<UserAnalytics />} />
        <Route path="/security-scanner" element={<SecurityScanner />} />
        <Route path="/cognitive-ai" element={<CognitiveChat />} />
        <Route path="/aq-dashboard" element={<AQDashboard />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/telegram-alerts" element={<TelegramAlertsSettings />} />
        <Route path="/agents" element={<AgentsOrchestrator />} />
        <Route path="/agent-network" element={<AgentNetwork />} />
        <Route path="/skills" element={<SkillManager />} />
        <Route path="/knowledge-base" element={<DocumentIndexer />} />
        <Route path="/agent-reports" element={<AgentReports />} />
        <Route path="/brochure" element={<SaasBrochure />} />
        <Route path="/monitor" element={<SystemMonitor />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
