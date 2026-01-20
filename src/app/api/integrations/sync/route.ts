import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { enqueueEmailSync } from '@/utils/sqs';

export async function POST(request: NextRequest) {
  try {
    const { grantId, userId } = await request.json();

    if (!grantId || !userId) {
      return NextResponse.json(
        { error: 'Missing grantId or userId' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user || user.id !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Update integration status to syncing
    await supabase
      .from('integrations')
      .update({ status: 'syncing' })
      .eq('nylas_grant_id', grantId)
      .eq('user_id', userId);

    // Enqueue sync job to SQS for async processing
    await enqueueEmailSync(grantId, userId);

    return NextResponse.json({
      success: true,
      message: 'Sync job queued for processing',
    });
  } catch (error) {
    console.error('Error in sync API:', error);
    return NextResponse.json(
      { error: 'Failed to queue sync job' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check sync status
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: integrations, error: intError } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id);

    if (intError) {
      throw intError;
    }

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch integrations' },
      { status: 500 }
    );
  }
}
