import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api.js";
import { useOrg } from "../context/org.js";
import { useToast } from "../context/toast.js";
import type { Monitor, MonitorType } from "../types.js";
import { Icon } from "./Icon.js";
import { Modal } from "./Modal.js";

interface StepDraft {
  method: string;
  url: string;
  expectedStatus: number;
  bodyContains: string;
}

const emptyStep = (): StepDraft => ({ method: "GET", url: "", expectedStatus: 200, bodyContains: "" });

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

export function CreateMonitor({ onClose }: { onClose: () => void }) {
  const { orgId } = useOrg();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<MonitorType>("http");
  const [intervalSeconds, setInterval] = useState(60);
  const [failThreshold, setFailThreshold] = useState(3);
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);

  const setStep = (index: number, patch: Partial<StepDraft>) =>
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const create = useMutation({
    mutationFn: () =>
      api<Monitor>("/monitors", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          name,
          type,
          intervalSeconds,
          failThreshold,
          steps: (type === "http" ? steps.slice(0, 1) : steps).map((s) => ({
            url: s.url,
            method: s.method,
            expectedStatus: s.expectedStatus,
            assertions: s.bodyContains.trim()
              ? [{ type: "bodyContains", value: s.bodyContains.trim() }]
              : [],
          })),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monitors", orgId] });
      toast("Monitor created", "success");
      onClose();
    },
    onError: (err: Error) => toast(err.message, "error"),
  });

  const canSubmit = name.trim().length > 0 && steps.every((s) => s.url.trim().length > 0) && Boolean(orgId);

  return (
    <Modal
      title="New monitor"
      onClose={onClose}
      footer={
        <>
          <button className="btn secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Creating…" : "Create monitor"}
          </button>
        </>
      }
    >
      <label>
        Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Marketing site"
          autoFocus
        />
      </label>

      <div>
        <span className="field-label" style={{ display: "block", marginBottom: 8 }}>
          Type
        </span>
        <div className="segmented">
          <button className={type === "http" ? "active" : ""} onClick={() => setType("http")} type="button">
            HTTP check
          </button>
          <button
            className={type === "journey" ? "active" : ""}
            onClick={() => {
              setType("journey");
              if (steps.length === 1) setSteps([steps[0]!, emptyStep()]);
            }}
            type="button"
          >
            Multi-step journey
          </button>
        </div>
      </div>

      <div className="form-row">
        <label>
          Interval (seconds)
          <input
            type="number"
            min={30}
            max={3600}
            value={intervalSeconds}
            onChange={(e) => setInterval(Number(e.target.value))}
          />
        </label>
        <label>
          Failure threshold
          <input
            type="number"
            min={1}
            max={10}
            value={failThreshold}
            onChange={(e) => setFailThreshold(Number(e.target.value))}
          />
        </label>
      </div>

      <div className="stack">
        {(type === "http" ? steps.slice(0, 1) : steps).map((step, i) => (
          <div className="step-editor" key={i}>
            {type === "journey" && (
              <div className="head">
                <strong>Step {i + 1}</strong>
                {steps.length > 1 && (
                  <button
                    className="btn ghost sm"
                    type="button"
                    onClick={() => setSteps(steps.filter((_, idx) => idx !== i))}
                  >
                    <Icon name="trash" size={15} />
                    Remove
                  </button>
                )}
              </div>
            )}
            <div className="form-row">
              <label>
                Method
                <select value={step.method} onChange={(e) => setStep(i, { method: e.target.value })}>
                  {methods.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Expected status
                <input
                  type="number"
                  value={step.expectedStatus}
                  onChange={(e) => setStep(i, { expectedStatus: Number(e.target.value) })}
                />
              </label>
            </div>
            <label>
              URL
              <input
                type="url"
                value={step.url}
                onChange={(e) => setStep(i, { url: e.target.value })}
                placeholder="https://example.com/health"
              />
            </label>
            <label>
              Body contains (optional)
              <input
                value={step.bodyContains}
                onChange={(e) => setStep(i, { bodyContains: e.target.value })}
                placeholder='"status":"ok"'
              />
            </label>
          </div>
        ))}

        {type === "journey" && (
          <button className="btn secondary" type="button" onClick={() => setSteps([...steps, emptyStep()])}>
            <Icon name="plus" size={16} />
            Add step
          </button>
        )}
      </div>
    </Modal>
  );
}
