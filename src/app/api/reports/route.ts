import { route } from "@/lib/api";
import { isYmd } from "@/lib/dates";
import { buildReport } from "@/lib/report";

export const GET = route(async (req) => {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  return buildReport({
    from: isYmd(from) ? from : undefined,
    to: isYmd(to) ? to : undefined,
    deliveredOnly: sp.get("delivered") === "1",
  });
});
