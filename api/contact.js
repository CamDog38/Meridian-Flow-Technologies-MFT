// Vercel serverless function: receives the contact form and sends it by SMTP.
// Credentials come from environment variables (see .env.example). Never hard-code them.
import nodemailer from "nodemailer";

const MAX_FIELD = 2000;

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
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

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_FROM, CONTACT_TO } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !CONTACT_FROM || !CONTACT_TO) {
    console.error("Contact form: SMTP environment variables are not set.");
    return res.status(500).json({ ok: false, error: "The enquiry could not be sent. Please try again later." });
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: false,
    requireTLS: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

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
    await transporter.sendMail({
      from: `"MFT Website" <${CONTACT_FROM}>`,
      to: CONTACT_TO,
      replyTo: fields.email,
      subject: `Website enquiry from ${fields.fullName} (${fields.company})`,
      text,
      html,
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Contact form: SMTP send failed:", err.code || err.message);
    return res.status(502).json({ ok: false, error: "The enquiry could not be sent. Please try again later." });
  }
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
