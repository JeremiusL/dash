import { promises as fs } from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import { DATA_DIR } from "./store.js";

const TOKENS_FILE = path.join(DATA_DIR, "google-tokens.json");
const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"];

export function isConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(): string {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

export async function saveTokens(tokens: Credentials): Promise<void> {
  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

export async function loadTokens(): Promise<Credentials | null> {
  try {
    const raw = await fs.readFile(TOKENS_FILE, "utf-8");
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function isConnected(): Promise<boolean> {
  return (await loadTokens()) !== null;
}

export async function getAuthorizedClient() {
  const tokens = await loadTokens();
  if (!tokens) return null;
  const client = getOAuthClient();
  client.setCredentials(tokens);
  client.on("tokens", (newTokens) => {
    void saveTokens({ ...tokens, ...newTokens });
  });
  return client;
}
