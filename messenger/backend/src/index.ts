/**
 * Messenger Backend - Main Entry Point
 * Initializes Express, Socket.IO, middleware, and routes
 */
import 'dotenv/config';
import http from 'http';
import { app } from './app';
import { initializeSocketIO } from './services/socket.service';
import { initializeDatabase } from './config/database';
import { initializeRedis } from './config/redis';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3001;

async function bootstrap() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database connected');

    // Initialize Redis
    await initializeRedis();
    logger.info('Redis connected');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    initializeSocketIO(server);
    logger.info('Socket.IO initialized');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
