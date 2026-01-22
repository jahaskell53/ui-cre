import { NextRequest, NextResponse } from "next/server";
import { unsubscribe } from "@/lib/news/subscribers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
    <title>Unsubscribe Error</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        h1 { color: #e53e3e; }
    </style>
</head>
<body>
    <h1>Error</h1>
    <p>Email address is required to unsubscribe.</p>
</body>
</html>`,
        {
          status: 400,
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    const success = await unsubscribe(email);

    if (success) {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
    <title>Unsubscribed</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        h1 { color: #38a169; }
        .success { background-color: #c6f6d5; border: 1px solid #68d391; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="success">
        <h1>Successfully Unsubscribed</h1>
        <p>You have been unsubscribed from OpenMidmarket newsletters.</p>
        <p>We're sorry to see you go!</p>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
            If you change your mind, you can always resubscribe at
            <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.openmidmarket.com'}/news/settings">our settings page</a>.
        </p>
    </div>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }
      );
    } else {
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
    <title>Unsubscribe Error</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        h1 { color: #e53e3e; }
        .error { background-color: #fed7d7; border: 1px solid #fc8181; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="error">
        <h1>Error</h1>
        <p>Could not unsubscribe. The email address may not be in our system.</p>
        <p>If you continue to receive emails, please contact <a href="mailto:hello@openmidmarket.com">hello@openmidmarket.com</a>.</p>
    </div>
</body>
</html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html" },
        }
      );
    }
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
    <title>Unsubscribe Error</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
        h1 { color: #e53e3e; }
        .error { background-color: #fed7d7; border: 1px solid #fc8181; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="error">
        <h1>Error</h1>
        <p>An unexpected error occurred. Please try again later.</p>
        <p>If the problem persists, please contact <a href="mailto:hello@openmidmarket.com">hello@openmidmarket.com</a>.</p>
    </div>
</body>
</html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}
