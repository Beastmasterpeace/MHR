// انواع مشترک بین کلاینت و سرور پنل MHR

export type AuthMe = {
  authenticated: boolean;
  username?: string;
  setupRequired?: boolean;
};

export type SystemStats = {
  cpuPercent: number;
  cpuCores: number;
  cpuModel: string;
  ram: { total: number; used: number; percent: number };
  swap: { total: number; used: number; percent: number };
  disk: { total: number; used: number; percent: number };
  uptimeSec: number;
  hostname: string;
  platform: string;
  arch: string;
  nodeVersion: string;
  loadavg: number[];
};

export type PanelUser = {
  id: string;
  name: string;
  note: string | null;
  uuid: string | null;
  quotaBytes: number;
  unlimited: boolean;
  usedBytes: number;
  expiresAt: string | null;
  active: boolean;
  subToken: string;
  createdAt: string;
  updatedAt: string;
};

export type Inbound = {
  id: string;
  name: string;
  protocol: "vless" | "vmess" | "trojan";
  port: number;
  tlsEnabled: boolean;
  sni: string | null;
  fragmentEnabled: boolean;
  fragmentSize: string | null;
  fragmentInterval: string | null;
  echEnabled: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ActivityEntry = {
  id: string;
  type: string;
  message: string;
  meta: string | null;
  createdAt: string;
};

export type PanelSettings = {
  panelName: string;
  subHost: string;
  resetDay: number;
  coreAutoStart: boolean;
};

export type ShareLink = {
  remark: string;
  uri: string;
  protocol: string;
  port: number;
  inboundName: string;
};

export type SubInfo = {
  panelName: string;
  user: {
    name: string;
    note: string | null;
    quotaBytes: number;
    unlimited: boolean;
    usedBytes: number;
    expiresAt: string | null;
    active: boolean;
  };
  inbounds: Array<{
    name: string;
    protocol: string;
    port: number;
    tlsEnabled: boolean;
    sni: string | null;
    echEnabled: boolean;
    fragmentEnabled: boolean;
  }>;
  links: ShareLink[];
  subHost: string;
};

export type CoreSnapshot = {
  status: "stopped" | "starting" | "running" | "error";
  pid: number | null;
  version: string | null;
  startedAt: number | null;
  uptimeSec: number;
  lastError: string | null;
  exitCode: number | null;
  binExists: boolean;
  binPath: string;
  apiPort: number;
  logs: string[];
  totals: { up: number; down: number };
  rates: { up: number; down: number };
  inbounds: Array<{
    id: string;
    name: string;
    protocol: string;
    port: number;
    tlsEnabled: boolean;
    fragmentEnabled: boolean;
    userCount: number;
    liveUp: number;
    liveDown: number;
  }>;
  users: Array<{
    id: string;
    name: string;
    usedBytes: number;
    liveUp: number;
    liveDown: number;
    eligible: boolean;
  }>;
  issues: string[];
};
