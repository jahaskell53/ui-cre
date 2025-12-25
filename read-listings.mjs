import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseSecretKey) {
    console.error('❌ Error: SUPABASE_URL or SUPABASE_SECRET_KEY is missing.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey)

async function readListings() {
    console.log('🔍 Attempting to read from "loopnet_listings"...\n')

    const { data, error } = await supabase
        .from('loopnet_listings')
        .select('id, address, price, location, cap_rate, listing_url')
        .limit(10)

    if (error) {
        console.error('❌ Permission Error:')
        console.error(`  Message: ${error.message}`)
        console.error(`  Code: ${error.code}`)
        console.log('\n💡 This error (42501) usually means the database role does not have permission to access the table.')
        console.log('To fix this, go to your Supabase SQL Editor and run:')
        console.log('GRANT SELECT ON TABLE loopnet_listings TO anon, authenticated, service_role;')
        return
    }

    if (!data || data.length === 0) {
        console.log('⚠️ No listings found in the table.')
        return
    }

    console.log(`✅ Successfully fetched ${data.length} listings.\n`)

    console.table(data.map(item => ({
        Address: item.address,
        Price: item.price,
        Location: item.location,
        'Cap Rate': item.cap_rate
    })))
}

readListings()
