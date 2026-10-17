export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok(res, data = {}, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export function fail(res, status, code, message) {
  return res.status(status).json({ success: false, error: { code, message } });
}
