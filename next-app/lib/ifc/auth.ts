import { verifyCustomToken } from "@/lib/auth";

export function getContractorIdFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const payload = verifyCustomToken(authHeader.split("Bearer ")[1]);
  if (!payload || payload.role !== "contractor") return null;
  return payload.id;
}
