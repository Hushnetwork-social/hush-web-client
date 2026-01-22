import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Docker container readiness checks.
 * Used by docker-compose.e2e.yml to verify the web client is ready.
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
}
