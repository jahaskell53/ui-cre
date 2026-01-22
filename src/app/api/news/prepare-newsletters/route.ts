import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getActiveSubscribers, PreferredSendTime } from "@/lib/news/subscribers";
import { fetchArticlesForNewsletter } from "@/lib/news/newsletter-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minute timeout

// System default: Friday at 15:45 UTC
const SYSTEM_DEFAULT_DAY = 5; // Friday (0-6, Sunday-Saturday)
const SYSTEM_DEFAULT_HOUR = 15; // 15:45 UTC

export async function GET(request: NextRequest) {
  try {
    console.log('Starting newsletter preparation process...');

    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('UNAUTHORIZED: Invalid or missing auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Looking for subscribers who want newsletters at: ${oneHourFromNow.toISOString()}`);

    // Get all active subscribers
    const subscribers = await getActiveSubscribers();
    console.log(`Found ${subscribers.length} active subscribers`);

    if (subscribers.length === 0) {
      return NextResponse.json({
        message: 'No active subscribers found',
        newslettersPrepared: 0
      });
    }

    let preparedCount = 0;
    let skippedCount = 0;

    // Process each subscriber
    for (const subscriber of subscribers) {
      try {
        // Determine if this subscriber wants a newsletter in 1 hour
        const shouldPrepare = shouldPrepareNewsletterForSubscriber(subscriber, oneHourFromNow);

        if (!shouldPrepare) {
          skippedCount++;
          continue;
        }

        console.log(`Preparing newsletter for subscriber: ${subscriber.email}`);

        // Calculate scheduled send time (1 hour from now, in UTC)
        const scheduledSendAt = oneHourFromNow;

        // Fetch articles
        const { nationalArticles, localArticles } = await fetchArticlesForNewsletter(
          subscriber.selectedCounties,
          subscriber.selectedCities.map(city => city.name),
          subscriber.interests
        );
        const totalArticles = nationalArticles.length + localArticles.length;

        if (totalArticles === 0) {
          console.log(`No articles for ${subscriber.email}, skipping`);
          skippedCount++;
          continue;
        }

        const allArticles = [...nationalArticles, ...localArticles];

        // Create newsletter record in database with status "scheduled"
        const { data: newsletter, error: newsletterError } = await supabase
          .from("newsletters")
          .insert({
            subscriber_email: subscriber.email,
            status: 'scheduled',
            scheduled_send_at: scheduledSendAt.toISOString(),
            subject: null, // Will be generated when sending
          })
          .select("id")
          .single();

        if (newsletterError || !newsletter) {
          console.error(`Error creating newsletter for ${subscriber.email}:`, newsletterError);
          continue;
        }

        // Create newsletter article associations
        const articleLinks = allArticles.map(article => article.link);
        const { data: dbArticles } = await supabase
          .from("articles")
          .select("id, link")
          .in("link", articleLinks);

        const validArticleIds = (dbArticles || []).map(a => a.id);

        if (validArticleIds.length > 0) {
          const newsletterArticles = validArticleIds.map(articleId => ({
            newsletter_id: newsletter.id,
            article_id: articleId
          }));

          await supabase
            .from("newsletter_articles")
            .insert(newsletterArticles);
        }

        preparedCount++;
        console.log(`Prepared newsletter for ${subscriber.email}, scheduled for ${scheduledSendAt.toISOString()}`);

      } catch (error) {
        console.error(`Error preparing newsletter for ${subscriber.email}:`, error);
      }
    }

    const result = {
      message: 'Newsletter preparation completed',
      totalSubscribers: subscribers.length,
      newslettersPrepared: preparedCount,
      skipped: skippedCount
    };

    console.log('Newsletter preparation completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Newsletter preparation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to determine if we should prepare a newsletter for a subscriber
function shouldPrepareNewsletterForSubscriber(
  subscriber: { preferredSendTimes?: PreferredSendTime[]; timezone?: string },
  targetTime: Date
): boolean {
  // If no preferences, use system default (Friday 15:45 UTC)
  if (!subscriber.preferredSendTimes || subscriber.preferredSendTimes.length === 0) {
    const dayOfWeek = targetTime.getUTCDay();
    const hour = targetTime.getUTCHours();
    return dayOfWeek === SYSTEM_DEFAULT_DAY && hour === SYSTEM_DEFAULT_HOUR;
  }

  // Check each preferred send time
  const subscriberTimezone = subscriber.timezone || 'UTC';

  for (const preferredTime of subscriber.preferredSendTimes) {
    // Convert target time to subscriber's timezone
    const targetInSubscriberTz = new Date(targetTime.toLocaleString('en-US', { timeZone: subscriberTimezone }));
    const dayOfWeek = targetInSubscriberTz.getDay(); // 0-6 (Sunday-Saturday)
    const hour = targetInSubscriberTz.getHours(); // 0-23

    // Check if this matches the preferred time (within 1 hour window)
    if (dayOfWeek === preferredTime.dayOfWeek && hour === preferredTime.hour) {
      return true;
    }
  }

  return false;
}
