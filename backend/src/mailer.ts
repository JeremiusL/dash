import { ImapFlow } from "imapflow";

export function isConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// MIME-encodes the subject only if it has non-ASCII characters - plain ASCII
// subjects are left alone since encoding them would just make Gmail's UI
// (and any mail client) show the raw "=?UTF-8?B?...?=" instead of decoding it.
function encodeHeaderWord(value: string): string {
  return /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

function buildRawMessage(to: string, from: string, subject: string, text: string): string {
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderWord(subject)}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "MIME-Version: 1.0",
  ].join("\r\n");
  return `${headers}\r\n\r\n${text}`;
}

// Appends a draft directly to Gmail's Drafts folder over IMAP, using the same
// app-password credential already used elsewhere in this app - so approving
// an outreach draft puts it in front of a human to send themselves, rather
// than sending it outright.
export async function createDraft(opts: { to: string; subject: string; text: string }): Promise<void> {
  const user = process.env.GMAIL_USER!;
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass: process.env.GMAIL_APP_PASSWORD! },
    logger: false,
  });

  await client.connect();
  try {
    const message = buildRawMessage(opts.to, user, opts.subject, opts.text);
    await client.append("[Gmail]/Drafts", message, ["\\Draft"]);
  } finally {
    await client.logout();
  }
}
