/**
 * SafarGo - Enterprise Backend API Application Server
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './auth/auth.controller.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Static uploads
  const uploadsPath = path.resolve(__dirname, '..', '..', '..', 'public', 'uploads');
  app.use('/uploads', express.static(uploadsPath));

  // Authentication API Routes
  app.use('/api/auth', authRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'SafarGo Enterprise API',
      version: '1.0.0',
      resendConfigured: Boolean(process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith('re_your_')),
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

const PORT = process.env.PORT || 5000;
const app = createServer();

app.listen(PORT, () => {
  console.log(`[SafarGo Enterprise API] Server running on http://localhost:${PORT}`);
});
