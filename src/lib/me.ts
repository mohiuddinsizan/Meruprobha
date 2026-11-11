"use client";

import { useApi } from "./client";

export type Me = { _id: string; name: string; username: string; role: "super" | "admin" };

/** The signed-in account. */
export function useMe() {
  return useApi<Me>("/api/me", { revalidateOnFocus: false }).data;
}
