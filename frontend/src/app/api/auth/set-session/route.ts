import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { access_token, refresh_token, user } = await request.json();

    const response = NextResponse.json({
      success: true,
      user
    });

    response.cookies.set('pubg-auth-session', '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 604800,
    });

    return response;
  } catch (error) {
    console.error('Set-session error:', error);
    return NextResponse.json(
      { error: 'Failed to set session' },
      { status: 500 }
    );
  }
}
