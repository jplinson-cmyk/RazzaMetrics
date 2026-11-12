export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response
    .json()
    .catch(() => ({
      error: `The server is busy (${response.status}). Try again in a moment.`,
    }));
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status}).`);
  return data as T;
}
export const projectApi = <T>(
  id: string,
  path: string,
  method = "GET",
  body?: unknown,
) => api<T>(`/projects/${encodeURIComponent(id)}/${path}`, method, body);
