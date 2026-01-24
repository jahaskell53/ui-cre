import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForGrant } from '@/lib/nylas/client';
import { createClient } from '@/utils/supabase/server';
import { syncAllContacts } from '@/lib/nylas/sync';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        new URL('/network/connect?error=oauth_failed', request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/network/connect?error=missing_params', request.url)
      );
    }

    // Extract user ID and redirect from state
    const stateParts = state.split(':');
    const userId = stateParts[0];
    const redirectTo = stateParts[2] ? decodeURIComponent(stateParts[2]) : '/network/connect';

    // Exchange code for grant
    const grantResponse = await exchangeCodeForGrant(code);

    if (!grantResponse) {
      throw new Error('Failed to exchange code for grant');
    }

    // Create Supabase client
    const supabase = await createClient();

    // Store integration in database
    const { error: dbError } = await supabase
      .from('integrations')
      .insert({
        user_id: userId,
        nylas_grant_id: grantResponse.grantId,
        provider: grantResponse.provider,
        email_address: grantResponse.email,
        integration_type: 'both', // email and calendar
        status: 'syncing', // Will be updated to 'active' after sync completes
        metadata: {
          scopes: grantResponse.scope,
        },
      });

    if (dbError) {
      console.error('Error storing integration:', dbError);
      throw dbError;
    }

    // Trigger background sync - don't await to avoid blocking redirect
    syncAllContacts(grantResponse.grantId, userId)
      .then(() => console.log('Initial sync completed successfully'))
      .catch((err) => console.error('Failed to trigger sync:', err));

    // Redirect to success page or back to where they came from
    return NextResponse.redirect(
      new URL(`${redirectTo}?success=true`, request.url)
    );
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(
      new URL('/network/connect?error=callback_failed', request.url)
    );
  }
}
