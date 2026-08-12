import nodemailer from "nodemailer";

export function isConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; text: string }): Promise<void> {
  await getTransporter().sendMail({
    from: process.env.GMAIL_USER,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
}
