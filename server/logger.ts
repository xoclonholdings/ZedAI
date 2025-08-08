import pino from 'pino';
import { Request, Response, NextFunction } from 'express';

export const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function logRequest(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      requestId: (req as any).id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start
    });
  });
  next();
}
