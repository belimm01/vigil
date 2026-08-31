export interface Org {
  id: string;
  name: string;
  statusSlug: string | null;
  role: "owner" | "admin" | "viewer";
}

export interface Monitor {
  id: string;
  orgId: string;
  name: string;
  type: "http" | "journey";
  intervalSeconds: number;
  failThreshold: number;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  user: { id: string; email: string };
  tokens: { accessToken: string; refreshToken: string };
}
