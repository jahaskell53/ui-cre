import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Connection Test Script
 * 
 * This script tests the connection to your Supabase project using the keys
 * defined in your .env.local file.
 * 
 * Requires:
 * - SUPABASE_URL (e.g., https://xyz.supabase.co)
 * - SUPABASE_PUBLISHABLE_KEY (starts with sb_publishable_)
 * - SUPABASE_SECRET_KEY (starts with sb_secret_)
 * 
 * To run:
 * bun run test-supabase.mjs
 * or
 * node test-supabase.mjs (requires dotenv if not using a loader)
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
    console.error('❌ Error: SUPABASE_URL is missing in environment variables.')
    console.log('Please add SUPABASE_URL=https://your-project-id.supabase.co to your .env.local file.')
    process.exit(1)
}

async function testConnection() {
    console.log('🚀 Starting Supabase connection test...\n')
    console.log(`URL: ${supabaseUrl}`)

    // 1. Test Publishable Key (Client-side access)
    if (supabasePublishableKey) {
        console.log('\n--- Testing Publishable Key (Anon) ---')
        const supabase = createClient(supabaseUrl, supabasePublishableKey)

        // We try to fetch from a dummy table or just check the health
        // Note: This will likely return an error if the table doesn't exist, 
        // but the error message will confirm connection.
        const { data, error } = await supabase.from('_connection_test_').select('*').limit(1)

        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
                console.log('✅ Connection Sucessful: Reached the database (Table not found, which is expected).')
            } else {
                console.error('❌ Connection Issue:', error.message)
            }
        } else {
            console.log('✅ Connection Successful: Fetched data!', data)
        }
    }

    // 2. Test Secret Key (Admin/Service Role access)
    if (supabaseSecretKey) {
        console.log('\n--- Testing Secret Key (Service Role) ---')
        const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

        // Admin client can list users, which is a good test for service role permissions
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            page: 1,
            perPage: 1
        })

        if (error) {
            console.error('❌ Secret Key Error:', error.message)
        } else {
            console.log('✅ Secret Key Successful: Able to access Auth Admin API.')
            console.log(`Found ${data.users.length} users (limited to 1 in test).`)
        }
    }

    console.log('\n--- Test Completed ---')
}

testConnection().catch(err => {
    console.error('Unexpected error during test:', err)
})
