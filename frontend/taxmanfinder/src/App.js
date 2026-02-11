import "./App.css";

import {BrowserRouter as Router,Routes,Route} from 'react-router-dom';
import LoginPage from "./pages/auth/Login.tsx";
import SignUpPage from './pages/auth/Signup.tsx';
import ChatEmptyState from './pages/chat/ChatLayout/ChatEmptyState.tsx'
import ChatLayout from './pages/chat/ChatLayout/ChatLayout.tsx'
import ConversationView from './pages/chat/ChatLayout/ConversationView.tsx'

import ServicesList from "./pages/services/ServicesList";
import ServiceDetail from "./pages/services/ServiceDetail";
import AccountantDashboard from "./pages/dashboard/AccountantDashboard";


const AppRoutes = () =>{
  return(
    
    <Router>
      <Routes>
        <Route path='/login' element={<LoginPage/>}/>
        <Route path='/signup' element={<SignUpPage/>}/>

        <Route path="/services" element={<ServicesList />} />
        <Route path="/services/:serviceId" element={<ServiceDetail />} />


        <Route path="/dashboard/accountant" element={<AccountantDashboard />} />

        <Route path="/chat" element={<ChatLayout />}>
          <Route index element={<ChatEmptyState />} />

          <Route path=":conversationId" element={<ConversationView />} />
        </Route>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </Router>
  )
}

export default AppRoutes; 