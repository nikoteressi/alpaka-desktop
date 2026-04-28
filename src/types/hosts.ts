export interface Host {
  id: string;
  name: string;
  url: string;
  is_default: boolean;
  is_active: boolean;
  last_ping_status: "online" | "offline" | "unknown";
  last_ping_at: string | null;
  created_at: string;
}

export interface HostStatusChangePayload {
  host_id: string;
  status: "online" | "offline" | "unknown";
  latency_ms: number | null;
}
