export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL'
  | 'UNAVAILABLE';

export class AppError extends Error {
  statusCode: number;
  code: ErrorCode;
  details?: unknown;

  constructor(params: { statusCode: number; code: ErrorCode; message: string; details?: unknown }) {
    super(params.message);
    this.name = 'AppError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
  }
}

export const errors = {
  badRequest(message = 'Bad request', details?: unknown) {
    return new AppError({ statusCode: 400, code: 'BAD_REQUEST', message, details });
  },

  unauthorized(message = 'Unauthorized', details?: unknown) {
    return new AppError({ statusCode: 401, code: 'UNAUTHORIZED', message, details });
  },

  forbidden(message = 'Forbidden', details?: unknown) {
    return new AppError({ statusCode: 403, code: 'FORBIDDEN', message, details });
  },

  notFound(message = 'Not found', details?: unknown) {
    return new AppError({ statusCode: 404, code: 'NOT_FOUND', message, details });
  },

  conflict(message = 'Conflict', details?: unknown) {
    return new AppError({ statusCode: 409, code: 'CONFLICT', message, details });
  },

  internalServerError(message = 'Internal Server Error', details?: unknown) {
    return new AppError({ statusCode: 500, code: 'INTERNAL', message, details });
  },

  serviceUnavailable(message = 'Service unavailable', details?: unknown) {
    return new AppError({ statusCode: 503, code: 'UNAVAILABLE', message, details });
  },
};
