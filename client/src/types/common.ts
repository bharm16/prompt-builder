export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

export type AsyncResult<T, E = Error> = Promise<{ data: T } | { error: E }>;

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

