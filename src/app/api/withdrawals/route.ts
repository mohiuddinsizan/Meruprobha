import { route } from "@/lib/api";
import { withdraw } from "@/lib/money";

export const POST = route(async (req, _ctx, me) => withdraw(await req.json(), me));
