import { route } from "@/lib/api";
import { reverse } from "@/lib/money";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (_req, { params }, me) => reverse((await params).id, me), { superOnly: true });
