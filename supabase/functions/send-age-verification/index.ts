import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const ageVerificationSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  email: z.string().email("Invalid email format").max(255, "Email too long"),
  firstName: z.string().trim().min(1, "First name required").max(50, "First name too long").optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = ageVerificationSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid input: " + validationResult.error.errors[0]?.message }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { userId, email, firstName, dateOfBirth } = validationResult.data;
    
    // Sanitize firstName for use in email template
    const sanitizedFirstName = firstName ? firstName.replace(/[<>"'&]/g, '') : 'there';

    // Calculate age
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      throw new Error("Must be 18 or older to participate");
    }

    // Generate secure verification token
    const token = crypto.randomUUID() + "-" + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store token in database
    const { error: insertError } = await supabaseClient
      .from("age_verification_tokens")
      .insert({
        user_id: userId,
        token,
        email,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error("Error inserting token:", insertError);
      throw new Error("Failed to create verification token");
    }

    // Get the site URL for verification link
    const siteUrl = Deno.env.get("SITE_URL") || "https://rgdegvpfnilzkqpexgij.lovableproject.com";
    const verificationUrl = `${siteUrl}/verify-age?token=${token}`;

    // Send verification email
    const emailResponse = await resend.emails.send({
      from: "MatchPlay <noreply@match-play.co>",
      to: [email],
      subject: "Confirm Your Age - MatchPlay",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #2d5016 0%, #4a7c23 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">⛳ MatchPlay</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Skill-Based Golf Competition</p>
            </div>
            
            <div style="padding: 40px 30px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px 0;">Confirm Your Age</h2>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 20px 0;">
                Hi ${sanitizedFirstName},
              </p>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 20px 0;">
                To complete your MatchPlay registration, please confirm that you are <strong>18 years of age or older</strong>.
              </p>
              
              <p style="color: #4a4a4a; line-height: 1.6; margin: 0 0 20px 0;">
                This verification is required because MatchPlay hosts skill-based competitions with entry fees and prizes.
              </p>
              
              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0; border-left: 4px solid #4a7c23;">
                <p style="color: #4a4a4a; margin: 0 0 10px 0; font-size: 14px;">
                  <strong>By clicking the button below, you confirm that:</strong>
                </p>
                <ul style="color: #4a4a4a; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                  <li>You are at least 18 years old</li>
                  <li>The date of birth you provided (${new Date(dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}) is accurate</li>
                  <li>You understand this is a skill-based competition platform</li>
                </ul>
              </div>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #4a7c23 0%, #2d5016 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  I Confirm I Am 18+
                </a>
              </div>
              
              <p style="color: #888888; font-size: 12px; line-height: 1.6; margin: 30px 0 0 0;">
                This link will expire in 24 hours. If you did not create an account on MatchPlay, please ignore this email.
              </p>
            </div>
            
            <div style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #eaeaea;">
              <p style="color: #888888; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} MatchPlay. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Age verification email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, message: "Verification email sent" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending age verification email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
