import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Icon } from "../components/Icon.js";
import { useAuth } from "../context/auth.js";
import type { AuthResponse } from "../types.js";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api<AuthResponse>(`/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(mode === "register" ? { email, password, orgName } : { email, password }),
      }),
    onSuccess: (data) => {
      login(data.tokens.accessToken);
      navigate("/", { replace: true });
    },
  });

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-brand">
          <Icon name="pulse" size={30} className="logo" />
          <div style={{ textAlign: "left" }}>
            <h1 style={{ fontSize: "1.5rem" }}>Vigil</h1>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              Synthetic uptime &amp; performance monitoring
            </p>
          </div>
        </div>

        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          {mode === "register" && (
            <label>
              Organization
              <input value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
            </label>
          )}

          <button className="btn" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          {mutation.isError && <p className="error">{mutation.error.message}</p>}
        </form>

        <p className="switch">
          {mode === "login" ? "Need an account? " : "Have an account? "}
          <button className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
