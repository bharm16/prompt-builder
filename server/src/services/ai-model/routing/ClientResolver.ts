import type { IAIClient } from '@interfaces/IAIClient';
import type { ClientsMap, ModelConfigEntry } from '../types';

export class ClientResolver {
  private readonly clients: ClientsMap;
  private readonly availableClients: Set<string>;
  private readonly hasAny: boolean;

  constructor(clients: ClientsMap) {
    this.clients = clients;
    const available = Object.keys(clients).filter(key => clients[key] !== null);
    this.availableClients = new Set(available);
    this.hasAny = available.length > 0;
  }

  hasAnyClient(): boolean {
    return this.hasAny;
  }

  hasClient(clientName: string): boolean {
    return this.availableClients.has(clientName);
  }

  getAvailableClients(): string[] {
    return Object.keys(this.clients).filter(key => this.clients[key] !== null);
  }

  getClientByName(clientName: string): IAIClient | null {
    return this.clients[clientName] || null;
  }

  getClient(config: ModelConfigEntry): IAIClient {
    const client = this.clients[config.client];

    if (!client) {
      throw new Error(
        `Client '${config.client}' is not available. ` +
        `Available clients: ${Object.keys(this.clients).filter(k => this.clients[k]).join(', ')}. ` +
        `Configure fallbackTo in ModelConfig if automatic fallback is desired.`
      );
    }

    return client;
  }
}
