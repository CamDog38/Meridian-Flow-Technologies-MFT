// GET /api/challenge: returns a fresh question and a signed token for the contact form.
// Requires CHALLENGE_SECRET. Tokens expire after 10 minutes and are checked by api/contact.js.
import { issueChallenge } from "../lib/challenge.js";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  const secret = process.env.CHALLENGE_SECRET;
  if (!secret) {
    console.error("Challenge: CHALLENGE_SECRET is not set.");
    return res.status(500).json({ ok: false, error: "Check unavailable." });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(issueChallenge(secret));
}
