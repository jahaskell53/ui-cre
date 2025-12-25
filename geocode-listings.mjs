import { createClient } from '@supabase/supabase-js'

/**
 * Geocode Listings Script
 * 
 * 1. Fetches listings from 'loopnet_listings' that don't have coordinates.
 * 2. Geocodes addresses using Mapbox.
 * 3. Updates the database with latitude and longitude.
 */

const supabaseUrl = process.env.SUPABASE_URL
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY
const MAPBOX_TOKEN = 'pk.eyJ1IjoiamFoYXNrZWxsNTMxIiwiYSI6ImNsb3Flc3BlYzBobjAyaW16YzRoMTMwMjUifQ.z7hMgBudnm2EHoRYeZOHMA'

if (!supabaseUrl || !supabaseSecretKey) {
    console.error('❌ Error: SUPABASE_URL or SUPABASE_SECRET_KEY is missing.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseSecretKey)

async function geocodeAddress(address) {
    try {
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}`
        );
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            return data.features[0].center; // [lng, lat]
        }
    } catch (e) {
        console.error(`Geocoding failed for: ${address}`, e);
    }
    return null;
}

async function startGeocoding() {
    console.log('🚀 Starting batch geocoding...')

    // Get listings missing coordinates
    const { data: listings, error } = await supabase
        .from('loopnet_listings')
        .select('id, address, location')
        .is('latitude', null)
        .not('address', 'is', null)
        .limit(50) // Process in chunks to avoid rate limits

    if (error) {
        console.error('❌ Error fetching listings:', error.message)
        return
    }

    if (!listings || listings.length === 0) {
        console.log('✅ All listings already have coordinates or no addresses found.')
        return
    }

    console.log(`📦 Found ${listings.length} listings to geocode.`)

    for (const listing of listings) {
        const fullAddress = `${listing.address}, ${listing.location}`
        console.log(`🔍 Geocoding: ${fullAddress}`)

        const coords = await geocodeAddress(fullAddress)

        if (coords) {
            const [lng, lat] = coords
            const { error: updateError } = await supabase
                .from('loopnet_listings')
                .update({ latitude: lat, longitude: lng })
                .eq('id', listing.id)

            if (updateError) {
                console.error(`❌ Failed to update ${listing.id}:`, updateError.message)
            } else {
                console.log(`✅ Updated ${listing.id}: [${lat}, ${lng}]`)
            }
        } else {
            console.log(`⚠️ Could not find coordinates for: ${fullAddress}`)
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200))
    }

    console.log('\n✨ Batch complete. Run again to process more chunks.')
}

startGeocoding()
