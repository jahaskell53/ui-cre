import { NextRequest, NextResponse } from 'next/server';
import { generateAuthUrl } from '@/lib/nylas/client';
import { createClient } from '@/utils/supabase/server';
import type { Provider } from '@/lib/nylas/config';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const provider = searchParams.get('provider') as Provider;
    const redirect = searchParams.get('redirect');

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Generate OAuth URL with state containing user ID and optional redirect
    const stateData = redirect
      ? `${user.id}:${Date.now()}:${encodeURIComponent(redirect)}`
      : `${user.id}:${Date.now()}`;
    const { url } = generateAuthUrl(provider, stateData);

    // Redirect to OAuth provider
    return NextResponse.redirect(url);
  } catch (error) {
    console.error('Error initiating OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}
