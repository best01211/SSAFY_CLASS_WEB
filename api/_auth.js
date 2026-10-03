import crypto from "node:crypto";

const SESSION_COOKIE = "ssafy_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`필수 환경 변수 ${name}가 없습니다.`);
  return value;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sign(value) {
  return crypto.createHmac("sha256", requiredEnv("ADMIN_SESSION_SECRET"))
    .update(value)
    .digest("base64url");
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers?.cookie ?? "")
      .split(";")
      .map(part => part.trim().split("="))
      .filter(parts => parts.length >= 2)
      .map(([key, ...value]) => [key, decodeURIComponent(value.join("="))])
  );
}

export function validateAdminCredentials(adminId, adminPassword) {
  return safeEqual(adminId, requiredEnv("ADMIN_ID")) &&
    safeEqual(adminPassword, requiredEnv("ADMIN_PASSWORD"));
}

export function setAdminSession(response) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ expiresAt })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`
  );
}

export function clearAdminSession(response) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
  );
}

export function isAdminRequest(request) {
  try {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (!token) return false;
    const [payload, signature] = token.split(".");
    if (!payload || !signature || !safeEqual(signature, sign(payload))) return false;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(session.expiresAt) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return safeEqual(request.headers?.authorization ?? "", `Bearer ${secret}`);
}
