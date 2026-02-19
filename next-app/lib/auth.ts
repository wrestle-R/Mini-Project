import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "buildsync-dev-secret-change-in-production";

export interface CustomJwtPayload {
  id: string;
  email: string;
  role: "company" | "contractor";
}

export function signCustomToken(payload: CustomJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyCustomToken(token: string): CustomJwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as CustomJwtPayload;
  } catch {
    return null;
  }
}
