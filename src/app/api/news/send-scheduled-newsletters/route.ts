import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { articleCities, articleCounties, articleTags, articles, counties, newsletterArticles, newsletters, sources } from "@/db/schema";
import { sendAlertEmail } from "@/lib/news/alert";
import { EmailService } from "@/lib/news/newsletter-service";
import { generateEmailContentFromArticles, splitArticlesIntoNationalAndLocal } from "@/lib/news/newsletter-utils";
import { getSubscriberByEmail } from "@/lib/news/subscribers";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minute timeout

export async function GET(request: NextRequest) {
    try {
        console.log("Starting scheduled newsletter send process...");

        const authHeader = request.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            console.log("UNAUTHORIZED: Invalid or missing auth header");
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const now = new Date();
        console.log(`Current time: ${now.toISOString()}`);

        // Find all newsletters scheduled to be sent now or in the past
        const scheduledNewsletters = await db
            .select({
                id: newsletters.id,
                subscriber_email: newsletters.subscriberEmail,
                scheduled_send_at: newsletters.scheduledSendAt,
            })
            .from(newsletters)
            .where(and(eq(newsletters.status, "scheduled"), lte(newsletters.scheduledSendAt, now.toISOString())))
            .orderBy(asc(newsletters.scheduledSendAt));

        console.log(`Found ${scheduledNewsletters.length} newsletters ready to send`);

        if (scheduledNewsletters.length === 0) {
            return NextResponse.json({
                message: "No newsletters ready to send",
                emailsSent: 0,
            });
        }

        // Fetch newsletter_articles for all newsletters
        const newsletterIds = scheduledNewsletters.map((n) => n.id);
        const naRows = await db
            .select({ newsletter_id: newsletterArticles.newsletterId, article_id: newsletterArticles.articleId })
            .from(newsletterArticles)
            .where(
                newsletterIds.length === 1 ? eq(newsletterArticles.newsletterId, newsletterIds[0]) : inArray(newsletterArticles.newsletterId, newsletterIds),
            );

        const allArticleIds = [...new Set(naRows.map((r) => r.article_id))];

        // Fetch articles with source info
        let articleRows: {
            id: string;
            title: string;
            link: string;
            description: string | null;
            date: string;
            image_url: string | null;
            source_id: string;
            source_name: string | null;
            is_national: boolean | null;
        }[] = [];
        if (allArticleIds.length > 0) {
            articleRows = await db
                .select({
                    id: articles.id,
                    title: articles.title,
                    link: articles.link,
                    description: articles.description,
                    date: articles.date,
                    image_url: articles.imageUrl,
                    source_id: articles.sourceId,
                    source_name: sources.sourceName,
                    is_national: sources.isNational,
                })
                .from(articles)
                .leftJoin(sources, eq(articles.sourceId, sources.sourceId))
                .where(allArticleIds.length === 1 ? eq(articles.id, allArticleIds[0]) : inArray(articles.id, allArticleIds));
        }

        // Fetch counties for all articles
        const countyRows =
            allArticleIds.length > 0
                ? await db
                      .select({ article_id: articleCounties.articleId, county_name: counties.name })
                      .from(articleCounties)
                      .leftJoin(counties, eq(articleCounties.countyId, counties.id))
                      .where(allArticleIds.length === 1 ? eq(articleCounties.articleId, allArticleIds[0]) : inArray(articleCounties.articleId, allArticleIds))
                : [];

        // Fetch cities for all articles
        const cityRows =
            allArticleIds.length > 0
                ? await db
                      .select({ article_id: articleCities.articleId, city: articleCities.city })
                      .from(articleCities)
                      .where(allArticleIds.length === 1 ? eq(articleCities.articleId, allArticleIds[0]) : inArray(articleCities.articleId, allArticleIds))
                : [];

        // Fetch tags for all articles
        const tagRows =
            allArticleIds.length > 0
                ? await db
                      .select({ article_id: articleTags.articleId, tag: articleTags.tag })
                      .from(articleTags)
                      .where(allArticleIds.length === 1 ? eq(articleTags.articleId, allArticleIds[0]) : inArray(articleTags.articleId, allArticleIds))
                : [];

        // Build lookup maps
        const articleMap = new Map(articleRows.map((a) => [a.id, a]));
        const countiesByArticle = new Map<string, string[]>();
        const citiesByArticle = new Map<string, string[]>();
        const tagsByArticle = new Map<string, string[]>();

        for (const row of countyRows) {
            if (!countiesByArticle.has(row.article_id)) countiesByArticle.set(row.article_id, []);
            if (row.county_name) countiesByArticle.get(row.article_id)!.push(row.county_name);
        }
        for (const row of cityRows) {
            if (!citiesByArticle.has(row.article_id)) citiesByArticle.set(row.article_id, []);
            citiesByArticle.get(row.article_id)!.push(row.city);
        }
        for (const row of tagRows) {
            if (!tagsByArticle.has(row.article_id)) tagsByArticle.set(row.article_id, []);
            tagsByArticle.get(row.article_id)!.push(row.tag);
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
                    await db.update(newsletters).set({ status: "failed" }).where(eq(newsletters.id, newsletter.id));
                    errorCount++;
                    continue;
                }

                // Build articles list for this newsletter
                const nlNaRows = naRows.filter((r) => r.newsletter_id === newsletter.id);
                const nlArticles = nlNaRows
                    .map((na) => {
                        const article = articleMap.get(na.article_id);
                        if (!article) return null;
                        return {
                            title: article.title,
                            link: article.link,
                            description: article.description || "",
                            date: article.date,
                            source: article.source_name || article.source_id,
                            imageUrl: article.image_url || undefined,
                            tags: tagsByArticle.get(article.id) || [],
                            counties: countiesByArticle.get(article.id) || [],
                            cities: citiesByArticle.get(article.id) || [],
                            isNational: article.is_national || false,
                        };
                    })
                    .filter((a): a is NonNullable<typeof a> => a !== null);

                // Split into national and local articles using shared function
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { nationalArticles, localArticles } = splitArticlesIntoNationalAndLocal(nlArticles as any, subscriber.selectedCounties);

                // Generate email content
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const emailContent = generateEmailContentFromArticles(nationalArticles as any, localArticles as any);

                // Send email
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const success = await emailService.sendNewsletterToSubscriber(subscriber, emailContent, nlArticles as any);

                if (success) {
                    // Update newsletter status
                    await db
                        .update(newsletters)
                        .set({
                            status: "sent",
                            sentAt: now.toISOString(),
                        })
                        .where(eq(newsletters.id, newsletter.id));

                    successCount++;
                    console.log(`Successfully sent newsletter ${newsletter.id} to ${subscriber.email}`);
                } else {
                    // Mark as failed
                    await db.update(newsletters).set({ status: "failed" }).where(eq(newsletters.id, newsletter.id));
                    errorCount++;
                    console.error(`Failed to send newsletter ${newsletter.id} to ${subscriber.email}`);
                }

                // Add a small delay to avoid overwhelming the email service
                await new Promise((resolve) => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`Error processing newsletter ${newsletter.id}:`, error);

                // Mark as failed
                try {
                    await db.update(newsletters).set({ status: "failed" }).where(eq(newsletters.id, newsletter.id));
                } catch (updateError) {
                    console.error(`Error updating newsletter ${newsletter.id} status:`, updateError);
                }

                errorCount++;
            }
        }

        const result = {
            message: "Scheduled newsletter send process completed",
            totalNewsletters: scheduledNewsletters.length,
            emailsSent: successCount,
            errors: errorCount,
        };

        console.log("Scheduled newsletter send process completed:", result);

        if (errorCount > 0) {
            await sendAlertEmail(
                `⚠️ Newsletter send failures: ${errorCount}/${scheduledNewsletters.length}`,
                `The send-scheduled-newsletters cron completed with errors.\n\n` +
                    `Sent: ${successCount}\nFailed: ${errorCount}\nTotal: ${scheduledNewsletters.length}\n\n` +
                    `Check Vercel logs for details.`,
            );
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Error in GET /api/news/send-scheduled-newsletters:", error);
        await sendAlertEmail(
            "🚨 Newsletter send cron crashed",
            `The send-scheduled-newsletters cron threw an unexpected error.\n\n` +
                `Error: ${error instanceof Error ? error.message : String(error)}\n\n` +
                `Check Vercel logs for the full stack trace.`,
        );
        return NextResponse.json({ ok: false, error: error.message || "Internal server error" }, { status: 500 });
    }
}
