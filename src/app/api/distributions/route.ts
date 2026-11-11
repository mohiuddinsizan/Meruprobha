import { route } from "@/lib/api";
import { distribute } from "@/lib/money";

export const POST = route(async (req, _ctx, me) => distribute(await req.json(), me));
