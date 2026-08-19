import { TableClient } from "@azure/data-tables";

const TABLE_NAME = "outreachdrafts";
const CONFIG_TABLE_NAME = "outreachconfig";

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

// Holds the ICP SIC codes and outreach templates edited from the Outreach
// tab's Targeting/Templates sections - read by both this backend and the
// local outreach-agent pipeline (lib/dash_config.py) so an edit here takes
// effect on the next local run.
let configClient: TableClient | null = null;

export function getConfigTable(): TableClient {
  if (!configClient) {
    configClient = TableClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!, CONFIG_TABLE_NAME, {
      allowInsecureConnection: false,
    });
  }
  return configClient;
}
