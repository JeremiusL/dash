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

export function getClient(): ContainerAppsAPIClient {
  if (!client) {
    const credential = new ClientSecretCredential(
      process.env.AZURE_TENANT_ID!,
      process.env.AZURE_CLIENT_ID!,
      process.env.AZURE_CLIENT_SECRET!
    );
    client = new ContainerAppsAPIClient(credential, process.env.AZURE_SUBSCRIPTION_ID!);
  }
  return client;
}

export function resourceGroup(): string {
  return process.env.AZURE_RESOURCE_GROUP!;
}
