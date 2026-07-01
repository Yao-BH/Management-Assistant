export async function postJson<T>(url: string, payload: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`${url} failed: ${detail || response.status}`);
  }

  return response.json() as Promise<T>;
}
