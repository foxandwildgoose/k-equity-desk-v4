import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getEtfNewsSnapshot,
  getRoboticsCompanyMeta,
  getRoboticsCompanyNews,
  getRoboticsEtfs,
  getRoboticsResearch,
  getRoboticsUniverse,
} from "@/lib/theme-fns";
import { useAppStore } from "@/lib/store";

export function useEtfNewsSnapshot(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["etf-news-snapshot"],
    queryFn: () => getEtfNewsSnapshot(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
    enabled: opts?.enabled ?? true,
  });
}

/**
 * Robotics universe (F6.1): config ∪ user additions, verified server-side;
 * user-hidden keys are removed here. Unresolved names come back separately.
 */
export function useRoboticsUniverse(opts?: { enabled?: boolean }) {
  const custom = useAppStore((s) => s.roboticsCustom);
  const addedKr = useMemo(() => custom.added.filter((e) => e.market === "KR").map(({ code, name, segment, exposure }) => ({ code, name, segment, exposure })), [custom.added]);
  const addedUs = useMemo(() => custom.added.filter((e) => e.market === "US").map(({ code, name, segment, exposure }) => ({ code, name, segment, exposure })), [custom.added]);
  const q = useQuery({
    queryKey: ["robotics-universe", JSON.stringify(addedKr), JSON.stringify(addedUs)],
    queryFn: () => getRoboticsUniverse({ data: { addedKr, addedUs } }),
    staleTime: 55_000,
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
    enabled: opts?.enabled ?? true,
  });
  const removed = useMemo(() => new Set(custom.removed), [custom.removed]);
  const kr = useMemo(() => (q.data?.kr ?? []).filter((r) => !removed.has(r.key)), [q.data?.kr, removed]);
  const us = useMemo(() => (q.data?.us ?? []).filter((r) => !removed.has(r.key)), [q.data?.us, removed]);
  const hidden = useMemo(() => [...(q.data?.kr ?? []), ...(q.data?.us ?? [])].filter((r) => removed.has(r.key)), [q.data, removed]);
  return { ...q, kr, us, hidden };
}

export function useRoboticsEtfs(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["robotics-etfs"],
    queryFn: () => getRoboticsEtfs(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: false,
    enabled: opts?.enabled ?? true,
  });
}

export function useRoboticsResearch(krCodes: string[], usSymbols: string[], opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["robotics-research", krCodes.join(","), usSymbols.join(",")],
    queryFn: () => getRoboticsResearch({ data: { krCodes: krCodes.slice(0, 40), usSymbols: usSymbols.slice(0, 24) } }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled: (opts?.enabled ?? true) && krCodes.length + usSymbols.length > 0,
  });
}

export function useRoboticsCompanyMeta(krCodes: string[], usSymbols: string[], opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["robotics-company-meta", krCodes.join(","), usSymbols.join(",")],
    queryFn: () => getRoboticsCompanyMeta({ data: { krCodes: krCodes.slice(0, 40), usSymbols: usSymbols.slice(0, 24) } }),
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled: (opts?.enabled ?? true) && krCodes.length + usSymbols.length > 0,
  });
}

export function useRoboticsCompanyNews(target: { market: "KR" | "US"; code: string; name: string } | null) {
  return useQuery({
    queryKey: ["robotics-company-news", target?.market, target?.code],
    queryFn: () => getRoboticsCompanyNews({ data: target! }),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    enabled: target != null,
  });
}
