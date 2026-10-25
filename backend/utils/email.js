/**
 * Email Utility — Smart Irrigation & Farm Management System
 * Uses nodemailer. Falls back to console-log in development when no SMTP
 * credentials are configured so the app still works without an email server.
 */

const nodemailer = require('nodemailer');

// ── Build transporter ─────────────────────────────────────────────────────────
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // If no SMTP config, return null — emails will be logged to console
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port:   parseInt(process.env.SMTP_PORT  || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',   // true for port 465
    auth:   { user, pass },
  });
}

// ── Send helper ───────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const transporter = createTransporter();
  const from        = process.env.SMTP_FROM || 'Smart Irrigation System <noreply@smartirrigation.com>';

  if (!transporter) {
    // Dev fallback — print to console so we can verify email content
    console.log('\n── [EMAIL SIMULATION] ──────────────────────────────');
    console.log(`  To      : ${to}`);
    console.log(`  Subject : ${subject}`);
    console.log(`  Body    : ${text || '(html only)'}`);
    console.log('────────────────────────────────────────────────────\n');
    return { simulated: true };
  }

  const info = await transporter.sendMail({ from, to, subject, html, text });
  console.log(`  [EMAIL] Sent to ${to} — MessageId: ${info.messageId}`);
  return info;
}

// ── Email templates ───────────────────────────────────────────────────────────

/**
 * Sent when admin approves a user registration.
 */
async function sendApprovalEmail({ to, name, role, loginUrl }) {
  const roleLabel = {
    owner: 'Farm Owner', admin: 'Admin',
    office_manager: 'Office Manager', labor: 'Laborer',
  }[role] || role;

  const subject = 'Your account has been approved — Smart Irrigation System';
  const text =
    `Hello ${name},\n\n` +
    `Your registration request for the Smart Irrigation & Farm Management System has been approved.\n\n` +
    `Role: ${roleLabel}\n` +
    `You can now sign in at: ${loginUrl || 'http://localhost:5173/login'}\n\n` +
    `If you have any questions, please contact your Farm Administrator.\n\n` +
    `Smart Irrigation & Farm Management System\n` +
    `Ethiopian Agricultural Organisation Edition`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px;">
      <div style="background:#166534;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center;">
        <h2 style="color:#fff;margin:0;font-size:1.3rem;">Smart Irrigation &amp; Farm Management System</h2>
        <p style="color:#bbf7d0;margin:4px 0 0;font-size:0.85rem;">Ethiopian Agricultural Organisation Edition</p>
      </div>
      <div style="background:#fff;padding:28px 24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;background:#dcfce7;border-radius:50%;padding:14px;">
            <span style="font-size:2rem;">✓</span>
          </div>
        </div>
        <h3 style="color:#166534;font-size:1.1rem;margin:0 0 12px;">Account Approved</h3>
        <p style="color:#374151;line-height:1.7;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          Your registration request has been <strong style="color:#166534;">approved</strong>.
          You can now sign in to the system.
        </p>
        <table style="width:100%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:20px;border-collapse:collapse;">
          <tr><td style="padding:4px 0;color:#6b7280;font-size:0.85rem;">Role</td><td style="padding:4px 0;font-weight:600;color:#166534;">${roleLabel}</td></tr>
        </table>
        <div style="text-align:center;margin:24px 0;">
          <a href="${loginUrl || 'http://localhost:5173/login'}"
             style="background:#166534;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;">
            Sign In Now
          </a>
        </div>
        <p style="color:#9ca3af;font-size:0.8rem;margin:0;text-align:center;">
          If you did not create this account, please ignore this email.
        </p>
      </div>
    </div>`;

  return sendEmail({ to, subject, html, text });
}

/**
 * Sent when admin rejects a user registration.
 */
async function sendRejectionEmail({ to, name, reason }) {
  const subject = 'Your registration request — Smart Irrigation System';
  const text =
    `Hello ${name},\n\n` +
    `We regret to inform you that your registration request for the Smart Irrigation & Farm Management System has not been approved.\n\n` +
    (reason ? `Reason: ${reason}\n\n` : '') +
    `If you believe this is a mistake, please contact your Farm Administrator.\n\n` +
    `Smart Irrigation & Farm Management System\n` +
    `Ethiopian Agricultural Organisation Edition`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px;">
      <div style="background:#166534;padding:20px 24px;border-radius:10px 10px 0 0;text-align:center;">
        <h2 style="color:#fff;margin:0;font-size:1.3rem;">Smart Irrigation &amp; Farm Management System</h2>
        <p style="color:#bbf7d0;margin:4px 0 0;font-size:0.85rem;">Ethiopian Agricultural Organisation Edition</p>
      </div>
      <div style="background:#fff;padding:28px 24px;border-radius:0 0 10px 10px;border:1px solid #e5e7eb;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;background:#fee2e2;border-radius:50%;padding:14px;">
            <span style="font-size:2rem;">✕</span>
          </div>
        </div>
        <h3 style="color:#991b1b;font-size:1.1rem;margin:0 0 12px;">Registration Not Approved</h3>
        <p style="color:#374151;line-height:1.7;margin:0 0 8px;">Hello <strong>${name}</strong>,</p>
        <p style="color:#374151;line-height:1.7;margin:0 0 16px;">
          We regret to inform you that your registration request has <strong style="color:#991b1b;">not been approved</strong>.
        </p>
        ${reason ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
          <p style="margin:0;color:#7f1d1d;font-size:0.88rem;"><strong>Reason:</strong> ${reason}</p>
        </div>` : ''}
        <p style="color:#6b7280;font-size:0.85rem;line-height:1.6;margin:0;">
          If you believe this is a mistake, please contact your Farm Administrator for assistance.
        </p>
      </div>
    </div>`;

  return sendEmail({ to, subject, html, text });
}

module.exports = { sendEmail, sendApprovalEmail, sendRejectionEmail };
