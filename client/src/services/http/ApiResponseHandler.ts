import { ApiError } from "./ApiError";
import type { ApiErrorFactory } from "./ApiErrorFactory";

interface SafeParseOptions {
  allowEmpty?: boolean;
}

export class ApiResponseHandler {
  private readonly errorFactory: ApiErrorFactory;

  constructor(errorFactory: ApiErrorFactory) {
    this.errorFactory = errorFactory;
  }

  async handle(response: Response | null): Promise<unknown> {
    if (!response) {
      throw this.errorFactory.create({ message: "Empty response received" });
    }

    if (!response.ok) {
      const errorPayload = await this.safeParseErrorPayload(response);
      const message =
        (errorPayload &&
        typeof errorPayload === "object" &&
        "error" in errorPayload &&
        typeof errorPayload.error === "string"
          ? errorPayload.error
          : null) ||
        (errorPayload &&
        typeof errorPayload === "object" &&
        "message" in errorPayload &&
        typeof errorPayload.message === "string"
          ? errorPayload.message
          : null) ||
        response.statusText ||
        `HTTP ${response.status}`;

      const code =
        errorPayload &&
        typeof errorPayload === "object" &&
        "code" in errorPayload &&
        typeof errorPayload.code === "string"
          ? errorPayload.code
          : response.status === 429
            ? "RATE_LIMITED"
            : undefined;

      throw this.errorFactory.create({
        message,
        status: response.status,
        response: errorPayload,
        code,
      });
    }

    if (response.status === 204) {
      return null;
    }

    return this.safeParseJson(response, { allowEmpty: true });
  }

  mapError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }

    if (error && typeof error === "object" && "name" in error) {
      const name = error.name;
      if (name === "AbortError" || name === "TimeoutError") {
        return this.errorFactory.createTimeout();
      }
    }

    return this.errorFactory.createNetwork(error);
  }

  async safeParseJson(
    response: Response,
    { allowEmpty = false }: SafeParseOptions = {},
  ): Promise<unknown> {
    const bodyText = await this.readBodyText(response);
    if (bodyText === null) {
      if (allowEmpty) {
        return null;
      }

      throw this.errorFactory.create({
        message: "Failed to parse JSON response",
        status: response.status,
      });
    }

    try {
      return JSON.parse(bodyText) as unknown;
    } catch {
      throw this.errorFactory.create({
        message: "Failed to parse JSON response",
        status: response.status,
      });
    }
  }

  private async safeParseErrorPayload(response: Response): Promise<unknown> {
    const bodyText = await this.readBodyText(response);
    if (bodyText === null) {
      return null;
    }

    try {
      return JSON.parse(bodyText) as unknown;
    } catch {
      return null;
    }
  }

  private async readBodyText(response: Response): Promise<string | null> {
    try {
      const bodyText = await response.text();
      return bodyText.trim().length > 0 ? bodyText : null;
    } catch {
      return null;
    }
  }
}
