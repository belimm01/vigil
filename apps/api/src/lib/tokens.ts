import { SignJWT, jwtVerify } from "jose";
import { loadConfig } from "../config.js";

export type TokenType = "access" | "refresh";

export interface TokenClaims {
  sub: string;
  type: TokenType;
}

const secret = () => new TextEncoder().encode(loadConfig().JWT_SECRET);

export async function signToken(userId: string, type: TokenType): Promise<string> {
  const config = loadConfig();
  const ttl = type === "access" ? config.JWT_ACCESS_TTL : config.JWT_REFRESH_TTL;
  return new SignJWT({ type })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret());
}

export async function issueTokenPair(userId: string) {
  const [accessToken, refreshToken] = await Promise.all([
    signToken(userId, "access"),
    signToken(userId, "refresh"),
  ]);
  return { accessToken, refreshToken };
}

export async function verifyToken(token: string, expected: TokenType): Promise<TokenClaims> {
  const { payload } = await jwtVerify(token, secret());
  if (payload.type !== expected || typeof payload.sub !== "string") {
    throw new Error("Unexpected token type");
  }
  return { sub: payload.sub, type: expected };
}
