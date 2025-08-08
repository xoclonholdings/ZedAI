import cors from 'cors';
import { RequestHandler } from 'express';

const allowedOrigins = [
  'https://zed-ai.online',
  'https://www.zed-ai.online',
  'http://localhost:5173',
];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: false,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'OPTIONS'],
};

const corsMiddleware: RequestHandler = cors(corsOptions);
export default corsMiddleware;
