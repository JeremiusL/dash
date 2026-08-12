import { ClientSecretCredential } from "@azure/identity";
import { ContainerAppsAPIClient } from "@azure/arm-appcontainers";

export function isConfigured(): boolean {
  return Boolean(
    process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET &&
      process.env.AZURE_TENANT_ID &&
      process.env.AZURE_SUBSCRIPTION_ID &&
      process.env.AZURE_RESOURCE_GROUP
  );
}

let client: ContainerAppsAPIClient | null = null;
let credential: ClientSecretCredential | null = null;

export function getCredential(): ClientSecretCredential {
  if (!credential) {
    credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );
  }
  return credential;
}

export function getClient(): ContainerAppsAPIClient {
  if (!client) {
    client = new ContainerAppsAPIClient(getCredential(), process.env.AZURE_SUBSCRIPTION_ID!);
  }
  return client;
}

export function resourceGroup(): string {
  return process.env.AZURE_RESOURCE_GROUP!;
}
