import { api } from "./api";
export async function connectGoogle(_clientId: string, projectId: string) {
  window.location.assign(
    "/api/auth/login?project=" + encodeURIComponent(projectId),
  );
  return { success: true, email: "" };
}
export async function disconnectGoogle(_projectId: string) {
  await api("/google/disconnect", "POST");
}
export async function getStoredConnectionStatus(_projectId: string) {
  return (await api<{ connected: boolean }>("/google/status")).connected
    ? "connected"
    : "disconnected";
}
