import { verifyCustomToken } from "@/lib/auth";

export type IfcActor =
  | { role: "contractor"; id: string }
  | { role: "company"; id: string };

export function getIfcActorFromAuthHeader(authHeader: string | null): IfcActor | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
  if (!payload) return null;
  if (payload.role === "contractor") return { role: "contractor", id: payload.id };
  if (payload.role === "company") return { role: "company", id: payload.id };
  return null;
}

export function getContractorIdFromAuthHeader(authHeader: string | null): string | null {
  const actor = getIfcActorFromAuthHeader(authHeader);
  return actor?.role === "contractor" ? actor.id : null;
}
