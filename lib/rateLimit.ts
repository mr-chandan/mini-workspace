import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 30,  // 30 requests per minute
};

export function getClientIP(request: NextRequest): string {
  // Try various headers for the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback - this will be localhost in development
  return 'unknown';
}

export function checkRateLimit(
  ip: string,
  config: RateLimitConfig = defaultConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  
  // Clean up old entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  if (!entry || entry.resetTime < now) {
    // New window
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs,
    };
  }
  
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now,
    };
  }
  
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  };
}

export function rateLimitResponse(resetIn: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(resetIn / 1000)),
        'X-RateLimit-Remaining': '0',
      },
    }
  );
}

// Higher-order function to wrap API handlers with rate limiting
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config?: RateLimitConfig
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const ip = getClientIP(request);
    const { allowed, remaining, resetIn } = checkRateLimit(ip, config);
    
    if (!allowed) {
      return rateLimitResponse(resetIn);
    }
    
    const response = await handler(request);
    response.headers.set('X-RateLimit-Remaining', String(remaining));
    return response;
  };
}

// Specific rate limit configs for different endpoints
export const uploadRateLimit: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,  // 10 uploads per minute
};

export const askRateLimit: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 20,  // 20 questions per minute
};

export const healthRateLimit: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 60,  // 60 checks per minute
};
