import { TableClient } from "@azure/data-tables";

const TABLE_NAME = "outreachdrafts";

export function isConfigured(): boolean {
  return Boolean(process.env.AZURE_STORAGE_CONNECTION_STRING);
}

let client: TableClient | null = null;

export function getOutreachTable(): TableClient {
  if (!client) {
    client = TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!, TABLE_NAME, {
      allowInsecureConnection: false,
    });
  }
  return client;
}
