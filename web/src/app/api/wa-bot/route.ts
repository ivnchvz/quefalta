// POST /api/wa-bot  (called by the n8n workflow with each Zavu webhook event)
// → { messages: [...] }: the Zavu message bodies n8n should send, in order. Sends nothing itself.

import { loadDatasetFromDisk } from "@/lib/serverData";
import { replyTo } from "@/lib/waBot";

export async function POST(request: Request) {
  const event = await request.json().catch(() => null);
  if (!event) return Response.json({ messages: [] });
  const base = (process.env.PUBLIC_BASE_URL ?? new URL(request.url).origin).replace(/\/$/, "");
  const messages = replyTo(event, await loadDatasetFromDisk(), base);
  return Response.json({ messages });
}
