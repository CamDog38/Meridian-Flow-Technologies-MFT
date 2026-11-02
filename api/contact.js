// Vercel serverless function: receives the contact form and sends it through Resend.
// Credentials come from environment variables (see .env.example). Never hard-code them.
import { Resend } from "resend";
import { verifyChallenge } from "../lib/challenge.js";

const MAX_FIELD = 2000;
const ALLOWED_HOSTS = ["mft-me.com", "www.mft-me.com", "localhost", "127.0.0.1"];
const ALLOWED_SUFFIXES = [".vercel.app"];

function clean(value) {
  return String(value ?? "").trim().slice(0, MAX_FIELD);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// Browsers send Origin on cross-site POSTs. Reject requests from other sites.
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  let host;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  return ALLOWED_HOSTS.includes(host) || ALLOWED_SUFFIXES.some((s) => host.endsWith(s));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  if (!originAllowed(req)) {
    return res.status(403).json({ ok: false, error: "Request not allowed." });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};

  const fields = {
    fullName: clean(body.fullName),
    company: clean(body.company),
    email: clean(body.email),
    phone: clean(body.phone),
    country: clean(body.country),
    interest: clean(body.interest),
    message: clean(body.message),
  };

  if (!fields.fullName || !fields.company || !fields.email || !fields.interest || !fields.message) {
    return res.status(400).json({ ok: false, error: "Please complete all required fields." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  }

  const { RESEND_API_KEY, CONTACT_FROM, CONTACT_TO, CHALLENGE_SECRET } = process.env;
  if (!RESEND_API_KEY || !CONTACT_FROM || !CONTACT_TO || !CHALLENGE_SECRET) {
    console.error("Contact form: RESEND_API_KEY, CONTACT_FROM, CONTACT_TO or CHALLENGE_SECRET is not set.");
    return res.status(500).json({ ok: false, error: "The enquiry could not be sent. Please try again later." });
  }

  const check = verifyChallenge(CHALLENGE_SECRET, clean(body.challengeToken), clean(body.challengeAnswer));
  if (!check.ok) {
    console.warn("Contact form: challenge failed:", check.reason);
    return res.status(400).json({ ok: false, error: "The check question was not answered correctly. Please try again." });
  }

  const rows = [
    ["Full name", fields.fullName],
    ["Company", fields.company],
    ["Email", fields.email],
    ["Phone", fields.phone || "-"],
    ["Country", fields.country || "-"],
    ["Area of interest", fields.interest],
  ];

  const text = [
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Message:",
    fields.message,
  ].join("\n");

  const html = `
    <table cellpadding="6" style="font-family:Arial,sans-serif;font-size:14px">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="color:#555"><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`
        )
        .join("")}
    </table>
    <p style="font-family:Arial,sans-serif;font-size:14px"><strong>Message</strong></p>
    <p style="font-family:Arial,sans-serif;font-size:14px;white-space:pre-wrap">${escapeHtml(fields.message)}</p>
  `;

  try {
    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: `MFT Website <${CONTACT_FROM}>`,
      to: [CONTACT_TO],
      replyTo: fields.email,
      subject: `Website enquiry from ${fields.fullName} (${fields.company})`,
      text,
      html,
    });

    if (error) {
      console.error("Contact form: Resend rejected the email:", error.name, error.message);
      return res.status(502).json({ ok: false, error: "The enquiry could not be sent. Please try again later." });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Contact form: Resend request failed:", err.message);
    return res.status(502).json({ ok: false, error: "The enquiry could not be sent. Please try again later." });
  }
}
