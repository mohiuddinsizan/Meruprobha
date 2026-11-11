import { route, bad } from "@/lib/api";
import { isYmd } from "@/lib/dates";
import { preview } from "@/lib/money";

export const GET = route(async (req) => {
  const upTo = new URL(req.url).searchParams.get("upTo");
  if (!isYmd(upTo)) throw bad("Choose a date");
  return preview(upTo);
});
