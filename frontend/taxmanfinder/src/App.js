import "./App.css";

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/auth/Login.tsx";
import SignUpPage from "./pages/auth/Signup.tsx";
import ChatEmptyState from "./pages/chat/ChatLayout/ChatEmptyState.tsx";
import ChatLayout from "./pages/chat/ChatLayout/ChatLayout.tsx";
import ConversationView from "./pages/chat/ChatLayout/ConversationView.tsx";

import ServicesList from "./pages/services/ServicesList";
import ServiceDetail from "./pages/services/ServiceDetail";
import AccountantProfilePage from "./pages/accountants/AccountantProfile.tsx";
import AccountantsDirectory from "./pages/accountants/AccountantsDirectory.tsx";
import AccountantDashboard from "./pages/dashboard/AccountantDashboard";
import AccountantProfileEdit from "./pages/dashboard/AccountantProfileEdit.tsx";
import ClientDashboard from "./pages/dashboard/ClientDashboard.tsx";
import BookingsPage from "./pages/bookings/BookingsPage.tsx";
import DemoPaymentPage from "./pages/bookings/DemoPaymentPage.tsx";
import Home from "./pages/Home.tsx";
import AccountantOnboarding from "./pages/onboarding/AccountantOnboarding.tsx";
import MyServices from "./pages/services/MyServices.tsx";
import { AuthProvider } from "./auth/AuthProvider.tsx";
import { AppLayout } from "./components/AppHeader.tsx";
import { RequireAccountantDashboard, RequireAuth } from "./auth/RequireAuth.tsx";

const AppRoutes = () => {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/onboarding/accountant" element={<AccountantOnboarding />} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<ServicesList />} />
            <Route path="/services/:serviceId" element={<ServiceDetail />} />
            <Route path="/accountants" element={<AccountantsDirectory />} />
            <Route path="/accountants/:userId" element={<AccountantProfilePage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/bookings/:bookingId/pay" element={<DemoPaymentPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/dashboard/client" element={<ClientDashboard />} />
              <Route path="/dashboard/services" element={<MyServices />} />
              <Route element={<RequireAccountantDashboard />}>
                <Route path="/dashboard/accountant" element={<AccountantDashboard />} />
                <Route path="/dashboard/profile" element={<AccountantProfileEdit />} />
              </Route>
              <Route path="/chat" element={<ChatLayout />}>
                <Route index element={<ChatEmptyState />} />
                <Route path=":inquiryId" element={<ConversationView />} />
              </Route>
            </Route>
            <Route path="*" element={<Home />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
};

export default AppRoutes;
