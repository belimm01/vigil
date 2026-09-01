import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api.js";
import type { Org } from "../types.js";

const ORG_KEY = "vigil.org";

interface OrgContextValue {
  orgs: Org[];
  org: Org | undefined;
  orgId: string | undefined;
  setOrgId: (id: string) => void;
  query: UseQueryResult<Org[]>;
}

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const query = useQuery({ queryKey: ["orgs"], queryFn: () => api<Org[]>("/orgs") });
  const orgs = query.data ?? [];
  const [selected, setSelected] = useState<string | undefined>(
    () => localStorage.getItem(ORG_KEY) ?? undefined,
  );

  useEffect(() => {
    if (orgs.length === 0) return;
    if (!selected || !orgs.some((o) => o.id === selected)) {
      setSelected(orgs[0]!.id);
    }
  }, [orgs, selected]);

  const setOrgId = (id: string) => {
    setSelected(id);
    localStorage.setItem(ORG_KEY, id);
  };

  const org = orgs.find((o) => o.id === selected);

  return (
    <OrgContext.Provider value={{ orgs, org, orgId: org?.id, setOrgId, query }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
