import "./App.css";

import {BrowserRouter as Router,Routes,Route} from 'react-router-dom';
import LoginPage from "./pages/Login.tsx";
import SignUpPage from './pages/Signup.tsx';

const AppRoutes = () =>{
  return(
    <Router>
      <Routes>
        <Route path='/login' element={<LoginPage/>}/>
        <Route path='/signup' element={<SignUpPage/>}/>
      </Routes>
    </Router>
  )
}

export default AppRoutes; 