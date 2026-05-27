import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const GET = async () => {
  // Return a mock user info to bypass Market OIDC checks for the local endpoints
  return NextResponse.json({
    accountId: 1,
    sub: 'local-mock-user',
    name: 'Local Dev User',
    email: 'local@localhost',
  });
};
