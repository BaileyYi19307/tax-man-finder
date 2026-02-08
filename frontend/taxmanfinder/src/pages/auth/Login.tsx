import { useState } from "react";
import axios from "axios";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function loginUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/users/auth/login/",
        {
          email: email,
          password: password,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      
      console.log("success:", response.data);


    const access =
    response.data.access ||
    response.data.token ||
    response.data.access_token;

  const refresh =
    response.data.refresh ||
    response.data.refresh_token;

  const userId =
    response.data.user?.id ||
    response.data.user_id;


    if (!access) {
      console.error("Login succeeded but no access token found in response.data");
      return;
    }

    localStorage.setItem("access_token", access);

    if (refresh) localStorage.setItem("refresh_token", refresh);
    if (userId) localStorage.setItem("user_id", String(userId));


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

        <button type="submit">Login</button>
      </form>
    </div>
  );
}
