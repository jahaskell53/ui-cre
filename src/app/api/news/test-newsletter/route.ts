import { NextRequest, NextResponse } from "next/server";
import { EmailService } from "@/lib/news/email-service";
import { fetchArticlesForNewsletter, generateEmailContentFromArticles } from "@/lib/news/newsletter-utils";
import { getSubscriberByEmail } from "@/lib/news/subscribers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    console.log('Starting test newsletter send...');

    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.log('Auth check failed - continuing for testing purposes');
    }

    const testEmail = 'alon@greenpointcollection.com';
    console.log(`Sending test newsletter to: ${testEmail}`);

    // Get the actual subscriber from the database
    const testSubscriber = await getSubscriberByEmail(testEmail);
    if (!testSubscriber) {
      console.error(`Subscriber not found: ${testEmail}`);
      return NextResponse.json({
        error: 'Subscriber not found',
        email: testEmail
      }, { status: 404 });
    }

    if (!testSubscriber.isActive) {
      console.error(`Subscriber is not active: ${testEmail}`);
      return NextResponse.json({
        error: 'Subscriber is not active',
        email: testEmail
      }, { status: 400 });
    }

    console.log(`Found subscriber: ${testSubscriber.firstName} with counties: ${testSubscriber.selectedCounties?.join(', ')}`);

    // Fetch articles from database with interest-based filtering
    const { nationalArticles, localArticles } = await fetchArticlesForNewsletter(
      testSubscriber.selectedCounties,
      testSubscriber.selectedCities.map(city => city.name),
      testSubscriber.interests,
      "gemini-2.5-flash-lite"
    );
    const totalArticles = nationalArticles.length + localArticles.length;
    console.log(`Found ${nationalArticles.length} National and ${localArticles.length} Local articles (${totalArticles} total) for test newsletter`);

    if (totalArticles === 0) {
      console.log('No articles found for test newsletter');
      return NextResponse.json({
        message: 'No articles found for test newsletter',
        articlesFound: 0
      });
    }

    // Generate email content
    const emailContent = generateEmailContentFromArticles(nationalArticles, localArticles);
    console.log(`Generated email content for test newsletter`);

    // Combine articles for email service (for backwards compatibility)
    const allArticles = [...nationalArticles, ...localArticles];

    // Send email with CC to jakobihaskell@gmail.com
    const emailService = new EmailService();
    const success = await emailService.sendNewsletterToSubscriber(testSubscriber, emailContent, allArticles, 'jakobihaskell@gmail.com');

    if (success) {
      console.log(`Successfully sent test newsletter to ${testEmail} with CC to jakobihaskell@gmail.com`);

      return NextResponse.json({
        message: 'Test newsletter sent successfully',
        recipient: testEmail,
        cc: 'jakobihaskell@gmail.com',
        articlesCount: totalArticles,
        success: true
      });
    } else {
      console.error(`Failed to send test newsletter to ${testEmail}`);
      return NextResponse.json({
        message: 'Failed to send test newsletter',
        recipient: testEmail,
        success: false
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Test newsletter error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
