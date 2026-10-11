import { useEffect } from 'react'
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Home from '@/pages/Home';
import CautaTaxe from '@/pages/CautaTaxe';
import Harta from '@/pages/Harta';
import CostCursa from '@/pages/CostCursa';
import CursaDetail from '@/pages/CursaDetail';
import Localitati from '@/pages/Localitati';
import LocalitateDetail from '@/pages/LocalitateDetail';
import BazaTaxe from '@/pages/BazaTaxe';
import Surse from '@/pages/Surse';
import Vehicule from '@/pages/Vehicule';
import VehiculDetail from '@/pages/VehiculDetail';
import Alerte from '@/pages/Alerte';
import Setari from '@/pages/Setari';

const PUBLIC_AUTH_PATHS = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

const AuthenticatedApp = () => {
  const {
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    isAuthenticated,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (authError?.type !== 'auth_required') return;
    if (PUBLIC_AUTH_PATHS.has(location.pathname)) return;
    if (isAuthenticated) return;
    const returnTo = `${location.pathname}${location.search}`;
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
  }, [authError, isAuthenticated, location.pathname, location.search, navigate]);

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/cauta-taxe" element={<CautaTaxe />} />
          <Route path="/harta" element={<Harta />} />
          <Route path="/cost-cursa" element={<CostCursa />} />
          <Route path="/cursa/:id" element={<CursaDetail />} />
          <Route path="/localitati" element={<Localitati />} />
          <Route path="/localitati/:id" element={<LocalitateDetail />} />
          <Route path="/baza-taxe" element={<BazaTaxe />} />
          <Route path="/surse" element={<Surse />} />
          <Route path="/vehicule" element={<Vehicule />} />
          <Route path="/vehicule/:id" element={<VehiculDetail />} />
          <Route path="/alerte" element={<Alerte />} />
          <Route path="/setari" element={<Setari />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
