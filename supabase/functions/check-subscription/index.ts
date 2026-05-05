import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error("Authentication failed");
    const requestingUser = userData.user;
    if (!requestingUser) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: requestingUser.id });

    // Check if request includes user_id (admin checking another user)
    let targetUserId = requestingUser.id;
    let targetEmail = requestingUser.email;
    
    const body = await req.json().catch(() => ({}));
    if (body.user_id && body.user_id !== requestingUser.id) {
      // Verify requesting user is admin
      const { data: adminCheck } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', requestingUser.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!adminCheck) {
        throw new Error("Only admins can check other users' subscriptions");
      }
      
      // Get target user's email
      const { data: targetUserData, error: targetError } = await supabaseClient.auth.admin.getUserById(body.user_id);
      if (targetError || !targetUserData.user?.email) {
        throw new Error("Target user not found");
      }
      
      targetUserId = body.user_id;
      targetEmail = targetUserData.user.email;
      logStep("Admin checking another user", { targetUserId, targetEmail });
    }

    if (!targetEmail) throw new Error("User email not available");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: targetEmail, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning free tier");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    // Look at all non-terminal subscriptions so we can surface past_due / unpaid / trialing too
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });

    const liveStatuses = new Set(["active", "trialing", "past_due", "unpaid", "incomplete"]);
    const subscription = subscriptions.data.find((s) => liveStatuses.has(s.status));
    const hasActiveSub = !!subscription && (subscription.status === "active" || subscription.status === "trialing");

    let productId: string | null = null;
    let subscriptionEnd: string | null = null;
    let status: string | null = null;
    let cancelAtPeriodEnd = false;
    let latestInvoiceStatus: string | null = null;
    let latestInvoiceAmountDue: number | null = null;
    let latestInvoiceHostedUrl: string | null = null;

    if (subscription) {
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product as string;
      status = subscription.status;
      cancelAtPeriodEnd = !!subscription.cancel_at_period_end;
      logStep("Subscription found", { id: subscription.id, status, cancelAtPeriodEnd, end: subscriptionEnd });

      // Pull latest invoice for payment status
      if (subscription.latest_invoice) {
        try {
          const invoiceId = typeof subscription.latest_invoice === "string"
            ? subscription.latest_invoice
            : subscription.latest_invoice.id;
          const invoice = await stripe.invoices.retrieve(invoiceId);
          latestInvoiceStatus = invoice.status ?? null;
          latestInvoiceAmountDue = invoice.amount_due ?? null;
          latestInvoiceHostedUrl = invoice.hosted_invoice_url ?? null;
        } catch (invErr) {
          logStep("Could not fetch latest invoice", { error: String(invErr) });
        }
      }
    } else {
      logStep("No live subscription found");
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      status,
      cancel_at_period_end: cancelAtPeriodEnd,
      latest_invoice_status: latestInvoiceStatus,
      latest_invoice_amount_due: latestInvoiceAmountDue,
      latest_invoice_hosted_url: latestInvoiceHostedUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    const isAuth = errorMessage === "Authentication failed" || errorMessage === "No authorization header provided" || errorMessage === "User not authenticated";
    return new Response(JSON.stringify({ error: isAuth ? "Authentication failed" : "Unable to check subscription." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: isAuth ? 401 : 500,
    });
  }
});
