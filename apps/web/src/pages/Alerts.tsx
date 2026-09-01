import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api.js";
import { Icon } from "../components/Icon.js";
import { EmptyState, Skeleton } from "../components/ui.js";
import { useOrg } from "../context/org.js";
import { useToast } from "../context/toast.js";
import type { AlertChannel, AlertChannelType } from "../types.js";

const typeMeta: Record<AlertChannelType, { icon: "slack" | "mail" | "webhook"; label: string; field: string; placeholder: string; key: string }> = {
  slack: { icon: "slack", label: "Slack", field: "Webhook URL", placeholder: "https://hooks.slack.com/services/…", key: "webhookUrl" },
  email: { icon: "mail", label: "Email", field: "Recipient", placeholder: "alerts@example.com", key: "to" },
  webhook: { icon: "webhook", label: "Webhook", field: "Endpoint URL", placeholder: "https://example.com/hooks/vigil", key: "url" },
};

export function Alerts() {
  const { orgId, org } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [type, setType] = useState<AlertChannelType>("slack");
  const [value, setValue] = useState("");

  const canManage = org?.role === "owner" || org?.role === "admin";

  const channels = useQuery({
    queryKey: ["alert-channels", orgId],
    queryFn: () => api<AlertChannel[]>(`/alert-channels?orgId=${orgId}`),
    enabled: Boolean(orgId),
  });

  const create = useMutation({
    mutationFn: () =>
      api<AlertChannel>("/alert-channels", {
        method: "POST",
        body: JSON.stringify({ orgId, type, config: { [typeMeta[type].key]: value.trim() } }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-channels", orgId] });
      setValue("");
      toast("Alert channel added", "success");
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  const remove = useMutation({
    mutationFn: (channelId: string) => api(`/alert-channels/${channelId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-channels", orgId] });
      toast("Alert channel removed", "info");
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  return (
    <>
      <div className="page-head">
        <div className="title">
          <h1>Alerts</h1>
          <span className="subtle">Where Vigil sends incident notifications</span>
        </div>
      </div>

      {canManage && (
        <form
          className="card stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) create.mutate();
          }}
        >
          <div>
            <span className="field-label" style={{ display: "block", marginBottom: 8 }}>
              Channel type
            </span>
            <div className="segmented">
              {(Object.keys(typeMeta) as AlertChannelType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={type === t ? "active" : ""}
                  onClick={() => setType(t)}
                >
                  {typeMeta[t].label}
                </button>
              ))}
            </div>
          </div>
          <div className="cluster" style={{ alignItems: "flex-end" }}>
            <label style={{ flex: 1, minWidth: 240 }}>
              {typeMeta[type].field}
              <input
                type={type === "email" ? "email" : "url"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={typeMeta[type].placeholder}
                required
              />
            </label>
            <button className="btn" type="submit" disabled={create.isPending}>
              <Icon name="plus" size={16} />
              Add channel
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="section-title">
          <h2>Channels</h2>
        </div>
        {channels.isLoading ? (
          <div className="stack">
            <Skeleton height={40} />
            <Skeleton height={40} />
          </div>
        ) : channels.isError ? (
          <p className="error">{(channels.error as Error).message}</p>
        ) : (channels.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon="bell"
            title="No alert channels"
            hint={canManage ? "Add a channel above to get notified when incidents open." : "Ask an admin to configure alerting."}
          />
        ) : (
          <div className="stack">
            {channels.data!.map((ch) => (
              <div className="channel-row" key={ch.id}>
                <div className="info">
                  <Icon name={typeMeta[ch.type].icon} size={18} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{typeMeta[ch.type].label}</div>
                    <div className="config">{ch.config[typeMeta[ch.type].key]}</div>
                  </div>
                </div>
                {canManage && (
                  <button
                    className="btn danger sm"
                    onClick={() => remove.mutate(ch.id)}
                    disabled={remove.isPending}
                    aria-label="Remove channel"
                  >
                    <Icon name="trash" size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
