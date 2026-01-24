import { NextRequest, NextResponse } from "next/server";
import { fetchArticlesForNewsletter, generateEmailContentFromArticles } from "@/lib/news/newsletter-utils";
import { generateNewsletterHTML } from "@/lib/news/email-template";
import { EmailService } from "@/lib/news/email-service";

async function sendNewsletterInBackground(
  interests: string,
  counties: string[] | undefined,
  cities: string[] | undefined,
  email: string,
  firstName: string | undefined
) {
  console.log(`Sending newsletter - Email: ${email}, Interests: "${interests}", Counties: ${counties ? counties.join(', ') : 'all'}, Cities: ${cities ? cities.join(', ') : 'none'}`);

  // Fetch articles from database
  const { nationalArticles, localArticles } = await fetchArticlesForNewsletter(
    counties,
    cities,
    interests,
    "gemini-2.5-flash-lite"
  );
  const totalArticles = nationalArticles.length + localArticles.length;
  console.log(`Found ${nationalArticles.length} National and ${localArticles.length} Local articles (${totalArticles} total) after filtering`);

  if (totalArticles === 0) {
    console.log(`No articles found for ${email}`);
    throw new Error('No articles found for newsletter');
  }

  // Generate email content
  const emailContent = generateEmailContentFromArticles(nationalArticles, localArticles);

  const newsletterTitle = "OpenMidMarket News";
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const subject = `${dateStr} - ${newsletterTitle}`;

  // Generate full HTML using shared template
  const countyStr = counties && counties.length > 0 ? `Counties: ${counties.join(', ')}` : '';
  const cityStr = cities && cities.length > 0 ? `Cities: ${cities.join(', ')}` : '';
  const locations = [countyStr, cityStr].filter(Boolean).join(' | ') || 'All Regions';

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.openmidmarket.com';
  const unsubscribeUrl = `${baseUrl}/api/news/unsubscribe?email=${encodeURIComponent(email)}`;

  const fullHtml = generateNewsletterHTML({
    subscriberName: firstName || email.split('@')[0],
    content: emailContent,
    unsubscribeUrl: unsubscribeUrl,
    subscriberEmail: email,
    interests: interests,
    locations: locations,
    title: newsletterTitle
  });

  // Send email
  const emailService = new EmailService();
  const textContent = emailContent.replace(/<[^>]*>/g, ''); // Simple HTML to text conversion

  const emailSent = await emailService.sendEmail(email, {
    subject,
    html: fullHtml,
    text: textContent
  }, undefined, unsubscribeUrl);

  if (!emailSent) {
    throw new Error('Failed to send email');
  }

  console.log(`Newsletter sent successfully to ${email}`);
}

export async function POST(request: NextRequest) {
  try {
    console.log('Starting newsletter send...');

    const body = await request.json();
    const { interests, counties, cities, email, firstName } = body;

    if (!interests || interests.trim() === '') {
      return NextResponse.json({
        error: 'Interests are required',
        html: '<p>Please provide your interests to send the newsletter.</p>'
      }, { status: 400 });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({
        error: 'Email address is required',
        html: '<p>Please provide your email address to send the newsletter.</p>'
      }, { status: 400 });
    }

    console.log(`Send request - Email: ${email}, Interests: "${interests}", Counties: ${counties ? counties.join(', ') : 'all'}, Cities: ${cities ? cities.join(', ') : 'none'}`);

    // Send newsletter synchronously (await to ensure it completes in serverless)
    await sendNewsletterInBackground(interests, counties, cities, email, firstName);

    // Return success response after email is sent
    return NextResponse.json({
      success: true,
      message: 'Newsletter sent successfully!',
      html: '<div class="text-center p-8"><h2 class="text-2xl font-bold text-green-600 mb-4">✓ Newsletter Sent!</h2><p class="text-gray-600">Check your inbox at ' + email + '</p></div>'
    }, { status: 200 });

  } catch (error) {
    console.error('Error sending newsletter:', error);
    return NextResponse.json({
      error: 'Failed to send newsletter',
      details: error instanceof Error ? error.message : 'Unknown error',
      html: '<p>There was an error sending the newsletter. Please try again.</p>'
    }, { status: 500 });
  }
}
