import { useState } from "react";
import axios from "axios";

export default function LoginPage() {
  const [userName, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function loginUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/users/auth/login/",
        {
          email: userName,
          password: password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("success:", response.data);
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
          value={userName}
          onChange={(e) => setUsername(e.target.value)}
        />

        <label htmlFor="passwordInput">Password</label>
        <input
          id="passwordInput"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit">Login</button>
      </form>
    </div>
  );
}
