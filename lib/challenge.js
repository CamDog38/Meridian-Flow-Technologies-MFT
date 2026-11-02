// Stateless human check for the contact form. No database: the challenge is
// signed with CHALLENGE_SECRET (HMAC-SHA256) and carried by the client.
import crypto from "node:crypto";

export const POOL = [
  { q: "What is 7 + 4?", a: "11" },
  { q: "What is 9 × 3?", a: "27" },
  { q: "What is 15 − 6?", a: "9" },
  { q: "What is 12 ÷ 4?", a: "3" },
  { q: "How many sides does a triangle have?", a: "3" },
  { q: "How many days are in a week?", a: "7" },
  { q: "Which one is a type of valve: gate or granite?", a: "gate" },
  { q: "Which one is a fluid: water or steel?", a: "water" },
];

const TOKEN_TTL_MS = 10 * 60 * 1000;
const MIN_FILL_MS = 3000;

function sign(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function issueChallenge(secret) {
  const index = crypto.randomInt(POOL.length);
  const now = Date.now();
  const payload = Buffer.from(
    JSON.stringify({ i: index, iat: now, exp: now + TOKEN_TTL_MS })
  ).toString("base64url");
  return {
    question: POOL[index].q,
    token: `${payload}.${sign(secret, payload)}`,
  };
}

export function verifyChallenge(secret, token, answer) {
  if (typeof token !== "string" || !token.includes(".")) {
    return { ok: false, reason: "missing" };
  }
  const [payload, signature] = token.split(".");
  const expected = Buffer.from(sign(secret, payload));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: "forged" };
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  const now = Date.now();
  if (!POOL[data.i] || typeof data.iat !== "number" || typeof data.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (now > data.exp) return { ok: false, reason: "expired" };
  if (now - data.iat < MIN_FILL_MS) return { ok: false, reason: "too fast" };
  if (normalize(answer) !== normalize(POOL[data.i].a)) return { ok: false, reason: "wrong answer" };

  return { ok: true };
}
