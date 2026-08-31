import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api, setToken } from "../api.js";
import type { AuthResponse } from "../types.js";

export function Login({ onAuthed }: { onAuthed: () => void }) {
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
      setToken(data.tokens.accessToken);
      onAuthed();
    },
  });

  return (
    <div className="auth">
      <h1>Vigil</h1>
      <p className="muted">Synthetic uptime & performance monitoring</p>

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

        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "…" : mode === "login" ? "Sign in" : "Create account"}
        </button>

        {mutation.isError && <p className="error">{mutation.error.message}</p>}
      </form>

      <button className="link" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Need an account? Register" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
