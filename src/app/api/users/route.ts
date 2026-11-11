import { route } from "@/lib/api";
import { User } from "@/lib/models";
import { parseUser, publicUser } from "@/lib/users";

export const GET = route(async () => {
  const users = await User.find().sort({ role: -1, active: -1, createdAt: 1 }).lean();
  return users.map(publicUser);
});

export const POST = route(async (req) => {
  const u = await User.create({ ...(await parseUser(await req.json(), null)), role: "admin" });
  return { _id: String(u._id) };
}, { superOnly: true });
