export class FetchHttpTransport {
  async send(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, init);
  }
}

