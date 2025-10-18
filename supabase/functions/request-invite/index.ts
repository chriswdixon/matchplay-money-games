import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteRequest {
  firstName: string;
  lastName: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { firstName, lastName, email }: InviteRequest = await req.json();

    console.log("Invite request received:", { firstName, lastName, email });

    // Validate input
    if (!firstName || !lastName || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Send email to support
    const emailResponse = await resend.emails.send({
      from: "MatchPlay Invites <onboarding@resend.dev>",
      to: ["support@match-play.co"],
      subject: "New Invite Code Request",
      html: `
        <h1>New Invite Code Request</h1>
        <p>A new user has requested an invite code:</p>
        <ul>
          <li><strong>Name:</strong> ${firstName} ${lastName}</li>
          <li><strong>Email:</strong> ${email}</li>
        </ul>
        <p>Please generate an invite code and send it to the user.</p>
      `,
    });

    console.log("Support notification sent:", emailResponse);

    // Send confirmation to user
    await resend.emails.send({
      from: "MatchPlay <onboarding@resend.dev>",
      to: [email],
      subject: "Invite Request Received - MatchPlay",
      html: `
        <h1>Thank you for your interest in MatchPlay!</h1>
        <p>Hi ${firstName},</p>
        <p>We've received your request for an invite code. Our team will review it and get back to you shortly.</p>
        <p>We're excited to have you join our golf matchmaking community!</p>
        <p>Best regards,<br>The MatchPlay Team</p>
      `,
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: "Invite request submitted successfully" 
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in request-invite function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
