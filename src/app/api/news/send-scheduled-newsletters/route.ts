import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getSubscriberByEmail } from "@/lib/news/subscribers";
import { EmailService } from "@/lib/news/email-service";
import { generateEmailContentFromArticles, splitArticlesIntoNationalAndLocal } from "@/lib/news/newsletter-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minute timeout

export async function GET(request: NextRequest) {
  try {
    console.log('Starting scheduled newsletter send process...');

    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('UNAUTHORIZED: Invalid or missing auth header');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();
    const now = new Date();
    console.log(`Current time: ${now.toISOString()}`);

    // Find all newsletters scheduled to be sent now or in the past
    const { data: scheduledNewsletters, error: fetchError } = await supabase
      .from("newsletters")
      .select(`
        id,
        subscriber_email,
        scheduled_send_at,
        newsletter_articles (
          article_id,
          articles (
            id,
            title,
            link,
            description,
            date,
            image_url,
            source_id,
            sources (source_name, is_national),
            article_counties (
              county_id,
              counties (name)
            ),
            article_cities (city),
            article_tags (tag)
          )
        )
      `)
      .eq("status", "scheduled")
      .lte("scheduled_send_at", now.toISOString())
      .order("scheduled_send_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching scheduled newsletters:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    console.log(`Found ${scheduledNewsletters?.length || 0} newsletters ready to send`);

    if (!scheduledNewsletters || scheduledNewsletters.length === 0) {
      return NextResponse.json({
        message: 'No newsletters ready to send',
        emailsSent: 0
      });
    }

    const emailService = new EmailService();
    let successCount = 0;
    let errorCount = 0;

    // Process each scheduled newsletter
    for (const newsletter of scheduledNewsletters) {
      try {
        console.log(`Processing newsletter ${newsletter.id} for ${newsletter.subscriber_email}`);

        // Get subscriber
        const subscriber = await getSubscriberByEmail(newsletter.subscriber_email);
        if (!subscriber || !subscriber.isActive) {
          console.log(`Subscriber ${newsletter.subscriber_email} not found or inactive, marking newsletter as failed`);
          await supabase
            .from("newsletters")
            .update({ status: 'failed' })
            .eq("id", newsletter.id);
          errorCount++;
          continue;
        }

        // Convert newsletter articles to the format expected by email service
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const articles = (newsletter.newsletter_articles || []).map((na: any) => {
          const article = na.articles;
          if (!article) return null;

          return {
            title: article.title,
            link: article.link,
            description: article.description || '',
            date: article.date,
            source: article.sources?.source_name || article.source_id,
            imageUrl: article.image_url || undefined,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tags: (article.article_tags || []).map((t: any) => t.tag),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            counties: (article.article_counties || []).map((c: any) => c.counties?.name).filter((n: unknown): n is string => !!n),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            cities: (article.article_cities || []).map((c: any) => c.city),
            isNational: article.sources?.is_national || false
          };
        }).filter((a: unknown) => a !== null);

        // Split into national and local articles using shared function
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { nationalArticles, localArticles } = splitArticlesIntoNationalAndLocal(articles as any, subscriber.selectedCounties);

        // Generate email content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emailContent = generateEmailContentFromArticles(nationalArticles as any, localArticles as any);

        // Send email
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const success = await emailService.sendNewsletterToSubscriber(subscriber, emailContent, articles as any);

        if (success) {
          // Update newsletter status
          await supabase
            .from("newsletters")
            .update({
              status: 'sent',
              sent_at: now.toISOString()
            })
            .eq("id", newsletter.id);

          successCount++;
          console.log(`Successfully sent newsletter ${newsletter.id} to ${subscriber.email}`);
        } else {
          // Mark as failed
          await supabase
            .from("newsletters")
            .update({ status: 'failed' })
            .eq("id", newsletter.id);
          errorCount++;
          console.error(`Failed to send newsletter ${newsletter.id} to ${subscriber.email}`);
        }

        // Add a small delay to avoid overwhelming the email service
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing newsletter ${newsletter.id}:`, error);

        // Mark as failed
        try {
          await supabase
            .from("newsletters")
            .update({ status: 'failed' })
            .eq("id", newsletter.id);
        } catch (updateError) {
          console.error(`Error updating newsletter ${newsletter.id} status:`, updateError);
        }

        errorCount++;
      }
    }

    const result = {
      message: 'Scheduled newsletter send process completed',
      totalNewsletters: scheduledNewsletters.length,
      emailsSent: successCount,
      errors: errorCount
    };

    console.log('Scheduled newsletter send process completed:', result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Scheduled newsletter send error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
