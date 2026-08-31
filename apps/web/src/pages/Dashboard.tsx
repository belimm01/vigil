import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, clearToken } from "../api.js";
import type { Monitor, Org } from "../types.js";

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const orgs = useQuery({ queryKey: ["orgs"], queryFn: () => api<Org[]>("/orgs") });
  const orgId = orgs.data?.[0]?.id;

  const monitors = useQuery({
    queryKey: ["monitors", orgId],
    queryFn: () => api<Monitor[]>(`/monitors?orgId=${orgId}`),
    enabled: Boolean(orgId),
    refetchInterval: 10_000,
  });

  const create = useMutation({
    mutationFn: () =>
      api<Monitor>("/monitors", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          name,
          type: "http",
          steps: [{ url, expectedStatus: 200 }],
        }),
      }),
    onSuccess: () => {
      setName("");
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["monitors", orgId] });
    },
  });

  const logout = () => {
    clearToken();
    onLogout();
  };

  return (
    <div className="dashboard">
      <header>
        <div>
          <h1>Vigil</h1>
          {orgs.data?.[0] && <span className="muted">{orgs.data[0].name}</span>}
        </div>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </header>

      <form
        className="card row"
        onSubmit={(e) => {
          e.preventDefault();
          if (orgId) create.mutate();
        }}
      >
        <input placeholder="Monitor name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button type="submit" disabled={create.isPending || !orgId}>
          Add monitor
        </button>
      </form>
      {create.isError && <p className="error">{create.error.message}</p>}

      <section className="monitors">
        {monitors.isLoading && <p className="muted">Loading…</p>}
        {monitors.data?.length === 0 && <p className="muted">No monitors yet. Add one above.</p>}
        {monitors.data?.map((monitor) => (
          <article key={monitor.id} className="card monitor">
            <div>
              <strong>{monitor.name}</strong>
              <span className="muted"> · every {monitor.intervalSeconds}s</span>
            </div>
            <span className={monitor.isActive ? "badge active" : "badge paused"}>
              {monitor.isActive ? "active" : "paused"}
            </span>
          </article>
        ))}
      </section>
    </div>
  );
}
