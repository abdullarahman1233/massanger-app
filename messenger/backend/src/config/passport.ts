/**
 * Passport.js strategy configuration
 * JWT strategy for API authentication
 */
import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { query } from './database';
import { logger } from '../utils/logger';

export function configurePassport(): void {
  // JWT Strategy
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
      },
      async (payload, done) => {
        try {
          const result = await query<{ id: string; email: string; role: string; is_banned: boolean }>(
            'SELECT id, email, role, is_banned FROM users WHERE id = $1 AND is_active = true',
            [payload.sub]
          );
          
          if (!result.rows[0]) {
            return done(null, false);
          }
          
          const user = result.rows[0];
          if (user.is_banned) {
            return done(null, false, { message: 'Account banned' });
          }
          
          return done(null, user);
        } catch (error) {
          return done(error, false);
        }
      }
    )
  );

  // Google OAuth Strategy (optional)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.API_BASE_URL}/api/auth/google/callback`,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email from Google'));

            // Upsert user from Google profile
            const result = await query<{ id: string; email: string; role: string }>(
              `INSERT INTO users (email, display_name, avatar_url, google_id, is_active)
               VALUES ($1, $2, $3, $4, true)
               ON CONFLICT (email) DO UPDATE SET google_id = $4, display_name = COALESCE(users.display_name, $2)
               RETURNING id, email, role`,
              [email, profile.displayName, profile.photos?.[0]?.value, profile.id]
            );
            return done(null, result.rows[0]);
          } catch (error) {
            logger.error('Google OAuth error:', error);
            return done(error as Error);
          }
        }
      )
    );
  }
}
