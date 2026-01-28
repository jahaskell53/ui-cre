import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    // if "next" is in search params, use it as the redirection URL
    const next = searchParams.get('next') ?? '/network'

    if (code) {
        const supabase = await createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            const forwardedHost = request.headers.get('x-forwarded-host') // i.e. vercel.com
            const isLocalEnv = process.env.NODE_ENV === 'development'
            if (isLocalEnv) {
                // we can be sure that origin is localhost
                return NextResponse.redirect(`${origin}${next}`)
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${next}`)
            } else {
                return NextResponse.redirect(`${origin}${next}`)
            }
        } else {
            // Handle specific error types
            let errorMessage = "Could not authenticate user";
            if (error.message?.includes("expired") || error.message?.includes("invalid")) {
                errorMessage = "Email link is invalid or has expired. Please request a new confirmation email.";
            }
            return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMessage)}`)
        }
    }

    // Check for error parameters in URL (from Supabase redirects)
    const errorParam = searchParams.get('error')
    const errorCode = searchParams.get('error_code')
    const errorDescription = searchParams.get('error_description')
    
    if (errorCode === 'otp_expired' || errorParam) {
        const errorMessage = errorDescription 
            ? decodeURIComponent(errorDescription)
            : "Email link is invalid or has expired. Please request a new confirmation email.";
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorMessage)}`)
    }

    // return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Could not authenticate user")}`)
}
