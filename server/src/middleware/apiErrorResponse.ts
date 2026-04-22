import type { Request, Response } from "express";
import type {
  ApiErrorResponse as ApiError,
  ApiErrorCode,
} from "@shared/types/api";

interface SendApiErrorPayload {
  error: string;
  code?: ApiErrorCode;
  details?: string;
}

type RequestWithId = Request & { id?: string };

export function sendApiError(
  res: Response,
  req: Request,
  status: number,
  payload: SendApiErrorPayload,
): Response<ApiError> {
  const requestId = (req as RequestWithId).id;
  const body: ApiError = {
    error: payload.error,
    ...(payload.code ? { code: payload.code } : {}),
    ...(payload.details ? { details: payload.details } : {}),
    ...(requestId ? { requestId } : {}),
  };

  return res.status(status).json(body);
}
