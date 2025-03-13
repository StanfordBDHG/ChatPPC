import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';

const USER_ID_COOKIE = 'user_id';
const COOKIE_EXPIRY_DAYS = 365; // 1 year

/**
 * Ensures a user ID exists in cookies, generating a new one if needed
 * @param req The Next.js request object
 * @returns The user ID
 */
export function ensureUserId(req: NextRequest): string {
  // Check if user ID already exists in cookies
  const existingUserId = req.cookies.get(USER_ID_COOKIE)?.value;
  
  if (existingUserId) {
    return existingUserId;
  }
  
  // Generate a new user ID
  return uuidv4();
}

/**
 * Sets the user ID cookie in a response
 * @param res The Next.js response object
 * @param userId The user ID to set
 * @returns The response with the cookie set
 */
export function setUserIdCookie(res: NextResponse, userId: string): NextResponse {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);
  
  res.cookies.set({
    name: USER_ID_COOKIE,
    value: userId,
    expires: expiryDate,
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });
  
  return res;
}

/**
 * Middleware for API routes to ensure user ID exists
 * @param handler The API route handler
 * @returns A wrapped handler that ensures user ID exists
 */
export function withUserId(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    const userId = ensureUserId(req);
    const res = await handler(req);
    
    // Only set cookie if user ID was newly generated
    if (!req.cookies.get(USER_ID_COOKIE)?.value) {
      return setUserIdCookie(res, userId);
    }
    
    return res;
  };
} 