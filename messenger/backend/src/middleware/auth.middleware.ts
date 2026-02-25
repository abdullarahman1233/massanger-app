/**
 * Authentication middleware using Passport JWT
 */
import { Request, Response, NextFunction } from 'express';
import passport from 'passport';

interface AuthUser {
  id: string;
  email: string;
  role: string;
}

/**
 * Require valid JWT token
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  passport.authenticate('jwt', { session: false }, (err: Error | null, user: AuthUser | false) => {
    if (err) return next(err);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = user;
    next();
  })(req, res, next);
}

/**
 * Require admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user as AuthUser;
  if (!user || user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
