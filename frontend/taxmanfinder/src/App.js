import "./App.css";

import {BrowserRouter as Router,Routes,Route} from 'react-router-dom';
import LoginPage from "./pages/auth/Login.tsx";
import SignUpPage from './pages/auth/Signup.tsx';
import ChatEmptyState from './pages/chat/ChatLayout/ChatEmptyState.tsx'
import ChatLayout from './pages/chat/ChatLayout/ChatLayout.tsx'
import ConversationView from './pages/chat/ChatLayout/ConversationView.tsx'

import ServicesList from "./pages/services/ServicesList";
import ServiceDetail from "./pages/services/ServiceDetail";
import AccountantProfilePage from "./pages/accountants/AccountantProfile.tsx";
import AccountantsDirectory from "./pages/accountants/AccountantsDirectory.tsx";
import AccountantDashboard from "./pages/dashboard/AccountantDashboard";
import ClientDashboard from "./pages/dashboard/ClientDashboard.tsx";
import BookingsPage from "./pages/bookings/BookingsPage.tsx";
import Home from "./pages/Home.tsx";
import AccountantOnboarding from "./pages/onboarding/AccountantOnboarding.tsx";
import MyServices from "./pages/services/MyServices.tsx";

const AppRoutes = () =>{
  return(
    
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path='/login' element={<LoginPage/>}/>
        <Route path='/signup' element={<SignUpPage/>}/>
        <Route path="/onboarding/accountant" element={<AccountantOnboarding />} />

        <Route path="/services" element={<ServicesList />} />
        <Route path="/services/:serviceId" element={<ServiceDetail />} />
        <Route path="/accountants" element={<AccountantsDirectory />} />
        <Route path="/accountants/:userId" element={<AccountantProfilePage />} />

        <Route path="/bookings" element={<BookingsPage/>}/>


        <Route path="/dashboard/accountant" element={<AccountantDashboard />} />
        <Route path="/dashboard/services" element={<MyServices />} />
        <Route path ="/dashboard/client" element ={<ClientDashboard/>}/>

        <Route path="/chat" element={<ChatLayout />}>
          <Route index element={<ChatEmptyState />} />

          <Route path=":inquiryId" element={<ConversationView />} />
        </Route>
        <Route path="*" element={<Home />} />
      </Routes>
    </Router>
  )
}

export default AppRoutes; 