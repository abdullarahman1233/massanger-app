/**
 * Authentication routes: register, login, refresh, logout, Google OAuth
 */
import { Router } from 'express';
import { body } from 'express-validator';
import passport from 'passport';
import { AuthController } from './auth.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';

export const authRouter = Router();
const controller = new AuthController();

// Register with email/password
authRouter.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('displayName').trim().isLength({ min: 1, max: 50 }),
    validate,
  ],
  controller.register.bind(controller)
);

// Login
authRouter.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    validate,
  ],
  controller.login.bind(controller)
);

// Refresh token
authRouter.post('/refresh', controller.refresh.bind(controller));

// Logout
authRouter.post('/logout', authenticate, controller.logout.bind(controller));

// Google OAuth
authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
authRouter.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  controller.googleCallback.bind(controller)
);
