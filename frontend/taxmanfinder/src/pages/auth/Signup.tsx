// fields=["email","password","role","id"]

import { useState } from "react";
import axios from "axios";
import {Link} from 'react-router-dom';
import { useNavigate } from "react-router-dom";

// <Link to="/"> Home >/Link>

export default function SignUpPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role,setRole]=useState("");

  async function loginUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/users/auth/signup/",
        {
          email: email,
          password: password,
          role:role
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("success:", response.data);
      //send them to login page
      navigate("/login",{replace:true});

    } catch (err: any) {
        console.log("status:", err.response?.status);
        console.log("data:", err.response?.data);
      }
      
  }

  return (
    <div>
      <form onSubmit={loginUser}>
        <label htmlFor="emailInput">Email</label>
        <input
          id="emailInput"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="passwordInput">Password</label>
        <input
          id="passwordInput"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
            <label htmlFor="role">Role</label>
            <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            >
            <option value="">Select a role</option>
            <option value="accountant">Accountant</option>
            <option value="client">Client</option>
            </select>


        <button type="submit">Signup</button>
      </form>
    </div>
  );
}
