import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting cache
const rateLimitCache = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string, maxRequests: number, windowSeconds: number): boolean {
  const now = Date.now()
  const userLimit = rateLimitCache.get(userId)

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitCache.set(userId, { count: 1, resetAt: now + windowSeconds * 1000 })
    return true
  }

  if (userLimit.count >= maxRequests) {
    return false
  }

  userLimit.count++
  return true
}

const postSchema = z.object({
  post: z.string().min(1).max(5000),
  platforms: z.array(z.string()).min(1),
  mediaUrls: z.array(z.string().url()).optional(),
  scheduleDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  tempMediaPaths: z.array(z.string()).optional(), // Paths to temp uploaded files
})

const getProfilesSchema = z.object({
  action: z.literal('get_profiles'),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check admin role
    const { data: hasAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    })

    if (!hasAdmin) {
      return new Response(
        JSON.stringify({ error: 'Access denied: Admin role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limiting: 10 requests per minute for admins
    if (!checkRateLimit(user.id, 10, 60)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestData = await req.json()
    const ayrshareApiKey = Deno.env.get('AYRSHARE_API_KEY')

    if (!ayrshareApiKey) {
      console.error('AYRSHARE_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Service configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Handle different actions
    if (requestData.action === 'get_profiles') {
      // Get connected social profiles
      const profilesResponse = await fetch('https://app.ayrshare.com/api/user', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ayrshareApiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (!profilesResponse.ok) {
        console.error('Ayrshare API error:', await profilesResponse.text())
        return new Response(
          JSON.stringify({ error: 'Unable to fetch social profiles' }),
          { status: profilesResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const profilesData = await profilesResponse.json()

      return new Response(
        JSON.stringify({ success: true, data: profilesData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Create a post
      const validatedData = postSchema.parse(requestData)

      let postText = validatedData.post

      // Add tags/hashtags if provided
      if (validatedData.tags && validatedData.tags.length > 0) {
        const hashtags = validatedData.tags.map(tag => tag.startsWith('#') ? tag : `#${tag}`).join(' ')
        postText = `${postText}\n\n${hashtags}`
      }

      const ayrsharePayload: any = {
        post: postText,
        platforms: validatedData.platforms,
      }

      // Handle temporary uploaded media
      if (validatedData.tempMediaPaths && validatedData.tempMediaPaths.length > 0) {
        const mediaUrls: string[] = []
        
        for (const path of validatedData.tempMediaPaths) {
          // Get public URL for temporary file
          const { data: urlData } = await supabaseClient
            .storage
            .from('temp-social-media')
            .getPublicUrl(path)
          
          if (urlData?.publicUrl) {
            mediaUrls.push(urlData.publicUrl)
          }
        }
        
        if (mediaUrls.length > 0) {
          ayrsharePayload.mediaUrls = mediaUrls
        }
      } else if (validatedData.mediaUrls && validatedData.mediaUrls.length > 0) {
        ayrsharePayload.mediaUrls = validatedData.mediaUrls
      }

      if (validatedData.scheduleDate) {
        ayrsharePayload.scheduleDate = validatedData.scheduleDate
      }

      console.log('Posting to Ayrshare:', { 
        platforms: validatedData.platforms, 
        postLength: postText.length,
        hasMedia: !!ayrsharePayload.mediaUrls,
        tags: validatedData.tags
      })

      const ayrshareResponse = await fetch('https://app.ayrshare.com/api/post', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ayrshareApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ayrsharePayload),
      })

      if (!ayrshareResponse.ok) {
        const errorText = await ayrshareResponse.text()
        console.error('Ayrshare API error:', errorText)
        return new Response(
          JSON.stringify({ error: 'Unable to post to social media' }),
          { status: ayrshareResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const ayrshareData = await ayrshareResponse.json()

      // Clean up temporary media files after successful post
      if (validatedData.tempMediaPaths && validatedData.tempMediaPaths.length > 0) {
        for (const path of validatedData.tempMediaPaths) {
          try {
            await supabaseClient
              .storage
              .from('temp-social-media')
              .remove([path])
            console.log('Cleaned up temp media:', path)
          } catch (cleanupError) {
            console.error('Error cleaning up temp media:', cleanupError)
            // Don't fail the request if cleanup fails
          }
        }
      }

      console.log('Ayrshare post successful:', { status: ayrshareData.status })

      return new Response(
        JSON.stringify({ success: true, data: ayrshareData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error: any) {
    console.error('Error in ayrshare-post function:', error)
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid request data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Unable to process request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
