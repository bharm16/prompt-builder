export class FetchHttpTransport {
  async send(url, init) {
    return fetch(url, init);
  }
}
