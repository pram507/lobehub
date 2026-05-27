import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export const POST = async () => {
  // Return a mock M2M token to bypass Market SDK checks
  return NextResponse.json({
    access_token: 'mock_m2m_token',
    token_type: 'Bearer',
    expires_in: 3600,
  });
};
