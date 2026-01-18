import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { EmailService } from "@/utils/email-service";
import { generateInvitationEmail } from "@/utils/email-templates";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { personId } = body;

    if (!personId) {
      return NextResponse.json({ error: "Person ID is required" }, { status: 400 });
    }

    // Fetch the person
    const { data: person, error: personError } = await supabase
      .from("people")
      .select("*")
      .eq("id", personId)
      .eq("user_id", user.id)
      .single();

    if (personError || !person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    if (!person.email) {
      return NextResponse.json({ error: "Person does not have an email address" }, { status: 400 });
    }

    // Generate invitation email content
    const emailContent = generateInvitationEmail({
      personName: person.name,
    });

    // Send the email
    const emailService = new EmailService();
    const emailSent = await emailService.sendEmail(person.email, emailContent);

    if (!emailSent) {
      return NextResponse.json({ error: "Failed to send invitation email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Invitation sent successfully" });
  } catch (error: any) {
    console.error("Error in POST /api/people/invite:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
