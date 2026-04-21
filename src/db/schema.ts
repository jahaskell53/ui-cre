import { sql } from "drizzle-orm";
import {
    bigserial,
    boolean,
    check,
    date,
    doublePrecision,
    foreignKey,
    geometry,
    index,
    integer,
    jsonb,
    numeric,
    pgMaterializedView,
    pgPolicy,
    pgSchema,
    pgSequence,
    pgTable,
    serial,
    text,
    timestamp,
    unique,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

const authSchema = pgSchema("auth");

export const users = authSchema.table("users", {
    id: uuid().primaryKey().notNull(),
});

export const cityBoundariesIdSeq = pgSequence("city_boundaries_id_seq", {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "9223372036854775807",
    cache: "1",
    cycle: false,
});

export const countyBoundariesIdSeq = pgSequence("county_boundaries_id_seq", {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "9223372036854775807",
    cache: "1",
    cycle: false,
});

export const msaBoundariesIdSeq = pgSequence("msa_boundaries_id_seq", {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "9223372036854775807",
    cache: "1",
    cycle: false,
});

export const zillowNeighborhoodsIdSeq = pgSequence("zillow_neighborhoods_id_seq", {
    startWith: "1",
    increment: "1",
    minValue: "1",
    maxValue: "2147483647",
    cache: "1",
    cycle: false,
});

export const cities = pgTable(
    "cities",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        name: text().notNull(),
        state: text().notNull(),
        stateAbbr: text("state_abbr").notNull(),
        createdAt: timestamp("created_at", { precision: 6, withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
        updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [
        uniqueIndex("cities_name_state_abbr_key").using("btree", table.name.asc().nullsLast().op("text_ops"), table.stateAbbr.asc().nullsLast().op("text_ops")),
        index("idx_cities_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
    ],
);

export const cityBoundaries = pgTable(
    "city_boundaries",
    {
        id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
        geoid: text().notNull(),
        name: text().notNull(),
        nameLsad: text("name_lsad"),
        stateFips: text("state_fips"),
        state: text(),
        lsad: text(),
        geom: geometry({ type: "multipolygon", srid: 4326 }),
    },
    (table) => [
        index("idx_city_boundaries_geom").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
        index("idx_city_boundaries_name").using("btree", table.name.asc().nullsLast().op("text_ops"), table.state.asc().nullsLast().op("text_ops")),
        index("idx_city_boundaries_state").using("btree", table.state.asc().nullsLast().op("text_ops")),
        unique("city_boundaries_geoid_key").on(table.geoid),
    ],
);

export const counties = pgTable(
    "counties",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        name: text().notNull(),
        createdAt: timestamp("created_at", { precision: 6, withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
        updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
    },
    (table) => [
        uniqueIndex("counties_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
        index("idx_counties_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
    ],
);

export const countyBoundaries = pgTable(
    "county_boundaries",
    {
        id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
        geoid: text().notNull(),
        name: text().notNull(),
        nameLsad: text("name_lsad"),
        stateFips: text("state_fips"),
        state: text(),
        geom: geometry({ type: "multipolygon", srid: 4326 }),
    },
    (table) => [
        index("idx_county_boundaries_geom").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
        index("idx_county_boundaries_name").using("btree", table.name.asc().nullsLast().op("text_ops"), table.state.asc().nullsLast().op("text_ops")),
        index("idx_county_boundaries_state").using("btree", table.state.asc().nullsLast().op("text_ops")),
        unique("county_boundaries_geoid_key").on(table.geoid),
    ],
);

export const events = pgTable(
    "events",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        title: text().notNull(),
        description: text(),
        startTime: timestamp("start_time", { withTimezone: true, mode: "string" }).notNull(),
        endTime: timestamp("end_time", { withTimezone: true, mode: "string" }).notNull(),
        location: text(),
        color: text().default("blue"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        imageUrl: text("image_url"),
        meetLink: text("meet_link"),
    },
    (table) => [
        index("events_start_time_idx").using("btree", table.startTime.asc().nullsLast().op("timestamptz_ops")),
        index("events_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "events_user_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Users can view own events", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
        pgPolicy("Users can create own events", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can update own events", { as: "permissive", for: "update", to: ["public"] }),
        pgPolicy("Users can delete own events", { as: "permissive", for: "delete", to: ["public"] }),
        pgPolicy("Users can insert their own events", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can update their own events", { as: "permissive", for: "update", to: ["public"] }),
        pgPolicy("Users can delete their own events", { as: "permissive", for: "delete", to: ["public"] }),
        pgPolicy("Everyone can view all events", { as: "permissive", for: "select", to: ["public"] }),
        check("events_color_check", sql`color = ANY (ARRAY['black'::text, 'blue'::text, 'green'::text, 'purple'::text, 'red'::text, 'orange'::text])`),
    ],
);

export const groups = pgTable(
    "groups",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        name: text().notNull(),
        color: text(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
    },
    (table) => [
        index("groups_created_at_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
        index("groups_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "groups_user_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Users can update their own groups", {
            as: "permissive",
            for: "update",
            to: ["public"],
            using: sql`(auth.uid() = user_id)`,
            withCheck: sql`(auth.uid() = user_id)`,
        }),
        pgPolicy("Users can delete their own groups", { as: "permissive", for: "delete", to: ["public"] }),
        pgPolicy("Users can view their own groups", { as: "permissive", for: "select", to: ["public"] }),
        pgPolicy("Users can insert their own groups", { as: "permissive", for: "insert", to: ["public"] }),
        check("name_not_empty", sql`char_length(TRIM(BOTH FROM name)) > 0`),
    ],
);

export const integrations = pgTable(
    "integrations",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        nylasGrantId: text("nylas_grant_id").notNull(),
        provider: text().notNull(),
        emailAddress: text("email_address").notNull(),
        integrationType: text("integration_type").notNull(),
        status: text().default("active"),
        firstSyncAt: timestamp("first_sync_at", { withTimezone: true, mode: "string" }),
        lastSyncAt: timestamp("last_sync_at", { withTimezone: true, mode: "string" }),
        syncError: text("sync_error"),
        metadata: jsonb().default({}),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
    },
    (table) => [
        index("idx_integrations_nylas_grant_id").using("btree", table.nylasGrantId.asc().nullsLast().op("text_ops")),
        index("idx_integrations_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "integrations_user_id_fkey",
        }).onDelete("cascade"),
        unique("integrations_nylas_grant_id_key").on(table.nylasGrantId),
        pgPolicy("Users can view their own integrations", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
        pgPolicy("Users can insert their own integrations", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can update their own integrations", { as: "permissive", for: "update", to: ["public"] }),
        pgPolicy("Users can delete their own integrations", { as: "permissive", for: "delete", to: ["public"] }),
    ],
);

export const kanbanColumns = pgTable(
    "kanban_columns",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        columns: text().array().default(["Active Prospecting", "Offering Memorandum", "Underwriting", "Due Diligence", "Closed/Archive"]).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
    },
    (table) => [
        index("kanban_columns_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "kanban_columns_user_id_fkey",
        }).onDelete("cascade"),
        unique("kanban_columns_user_id_key").on(table.userId),
        pgPolicy("Users can view their own kanban columns", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
        pgPolicy("Users can insert their own kanban columns", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can update their own kanban columns", { as: "permissive", for: "update", to: ["public"] }),
    ],
);

export const loopnetListings = pgTable(
    "loopnet_listings",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        listingUrl: text("listing_url").notNull(),
        thumbnailUrl: text("thumbnail_url"),
        brokerLogoUrl: text("broker_logo_url"),
        address: text(),
        addressRaw: text("address_raw"),
        addressStreet: text("address_street"),
        addressCity: text("address_city"),
        addressState: text("address_state"),
        addressZip: text("address_zip"),
        headline: text(),
        location: text(),
        city: text(),
        state: text(),
        zip: text(),
        price: text(),
        priceNumeric: integer("price_numeric"),
        capRate: text("cap_rate"),
        buildingCategory: text("building_category"),
        squareFootage: text("square_footage"),
        createdAt: timestamp("created_at", { precision: 6, withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
        updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
        latitude: doublePrecision(),
        longitude: doublePrecision(),
        description: text(),
        dateOnMarket: date("date_on_market"),
        dateListed: date("date_listed"),
        dateLastUpdated: date("date_last_updated"),
        pricePerUnit: text("price_per_unit"),
        grm: text(),
        numUnits: integer("num_units"),
        propertyType: text("property_type"),
        propertySubtype: text("property_subtype"),
        apartmentStyle: text("apartment_style"),
        buildingClass: text("building_class"),
        lotSize: text("lot_size"),
        buildingSize: text("building_size"),
        numStories: integer("num_stories"),
        yearBuilt: integer("year_built"),
        yearRenovated: integer("year_renovated"),
        constructionStatus: text("construction_status"),
        zoning: text(),
        zoningDistrict: text("zoning_district"),
        zoningDescription: text("zoning_description"),
        parcelNumber: text("parcel_number"),
        opportunityZone: boolean("opportunity_zone"),
        isAuction: boolean("is_auction"),
        saleType: text("sale_type"),
        brokerName: text("broker_name"),
        brokerCompany: text("broker_company"),
        brokerPhone: text("broker_phone"),
        brokerEmail: text("broker_email"),
        agentProfileUrl: text("agent_profile_url"),
        agentPhotoUrl: text("agent_photo_url"),
        submarketId: integer("submarket_id"),
        investmentHighlights: jsonb("investment_highlights"),
        highlights: jsonb(),
        amenities: jsonb(),
        unitMix: jsonb("unit_mix"),
        images: jsonb(),
        attachments: jsonb(),
        links: jsonb(),
        brokerDetails: jsonb("broker_details"),
        propertyTaxes: jsonb("property_taxes"),
        scrapedAt: timestamp("scraped_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
        runId: integer("run_id"),
        omUrl: text("om_url"),
        /** Cached S3 URLs for LoopNet listing attachments: `[{ source_url, url, description? }]` */
        attachmentUrls: jsonb("attachment_urls").default(sql`'[]'::jsonb`),
        geom: geometry({ type: "point", srid: 4326 }),
    },
    (table) => [
        index("idx_loopnet_listings_listing_url").using("btree", table.listingUrl.asc().nullsLast().op("text_ops")),
        index("idx_loopnet_listings_address_city_state_lower").using("btree", sql`lower(address_city)`, sql`lower(address_state)`),
        uniqueIndex("loopnet_listings_listing_url_run_id_key").on(table.listingUrl, table.runId),
        index("idx_loopnet_listings_geom")
            .using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d"))
            .where(sql`(geom IS NOT NULL)`),
        pgPolicy("Enable read access for all users", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
    ],
);

export const messages = pgTable(
    "messages",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        senderId: uuid("sender_id").notNull(),
        recipientId: uuid("recipient_id").notNull(),
        content: text().notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
    },
    (table) => [
        index("messages_created_at_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
        index("messages_recipient_sender_idx").using(
            "btree",
            table.recipientId.asc().nullsLast().op("uuid_ops"),
            table.senderId.asc().nullsLast().op("uuid_ops"),
        ),
        index("messages_sender_recipient_idx").using(
            "btree",
            table.senderId.asc().nullsLast().op("uuid_ops"),
            table.recipientId.asc().nullsLast().op("uuid_ops"),
        ),
        foreignKey({
            columns: [table.recipientId],
            foreignColumns: [users.id],
            name: "messages_recipient_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.senderId],
            foreignColumns: [users.id],
            name: "messages_sender_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Users can view their own messages", {
            as: "permissive",
            for: "select",
            to: ["public"],
            using: sql`((auth.uid() = sender_id) OR (auth.uid() = recipient_id))`,
        }),
        pgPolicy("Users can send messages", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can mark their received messages as read", { as: "permissive", for: "update", to: ["public"] }),
        check("content_not_empty", sql`char_length(TRIM(BOTH FROM content)) > 0`),
    ],
);

export const msaBoundaries = pgTable(
    "msa_boundaries",
    {
        id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
        geoid: text().notNull(),
        name: text().notNull(),
        nameLsad: text("name_lsad"),
        geom: geometry({ type: "multipolygon", srid: 4326 }),
    },
    (table) => [
        index("idx_msa_boundaries_geom").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
        index("idx_msa_boundaries_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
        unique("msa_boundaries_geoid_key").on(table.geoid),
    ],
);

export const neighborhoods = pgTable(
    "neighborhoods",
    {
        id: serial().primaryKey().notNull(),
        state: varchar({ length: 80 }),
        county: varchar({ length: 80 }),
        city: varchar({ length: 80 }),
        name: varchar({ length: 80 }),
        regionid: varchar({ length: 80 }),
        shapeLength: doublePrecision("shape_length"),
        shapeArea: doublePrecision("shape_area"),
        geom: geometry({ type: "multipolygon", srid: 4326 }),
    },
    (table) => [
        index("idx_neighborhoods_geom").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
        index("zillow_neighborhoods_geom_geom_idx").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
    ],
);

export const notifications = pgTable(
    "notifications",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        type: text().default("message").notNull(),
        title: text(),
        content: text().notNull(),
        relatedId: uuid("related_id"),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
    },
    (table) => [
        index("notifications_created_at_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
        index("notifications_type_idx").using("btree", table.type.asc().nullsLast().op("text_ops")),
        index("notifications_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        index("notifications_user_unread_idx")
            .using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.readAt.asc().nullsLast().op("timestamptz_ops"))
            .where(sql`(read_at IS NULL)`),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "notifications_user_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Users can view their own notifications", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
        pgPolicy("System can insert notifications", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can mark their notifications as read", { as: "permissive", for: "update", to: ["public"] }),
        check("content_not_empty", sql`char_length(TRIM(BOTH FROM content)) > 0`),
        check("valid_type", sql`type = ANY (ARRAY['message'::text, 'system'::text, 'mention'::text, 'like'::text, 'comment'::text])`),
    ],
);

export const people = pgTable(
    "people",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        name: text().notNull(),
        starred: boolean().default(false).notNull(),
        signal: boolean().default(false).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        email: text(),
        timeline: jsonb().default([]),
        address: text(),
        ownedAddresses: jsonb("owned_addresses").default([]),
        phone: text(),
        category: text(),
        addressLatitude: numeric("address_latitude"),
        addressLongitude: numeric("address_longitude"),
        ownedAddressesGeo: jsonb("owned_addresses_geo").default([]),
        bio: text(),
        birthday: date(),
        linkedinUrl: text("linkedin_url"),
        twitterUrl: text("twitter_url"),
        instagramUrl: text("instagram_url"),
        facebookUrl: text("facebook_url"),
        networkStrength: text("network_strength").default("MEDIUM"),
    },
    (table) => [
        index("idx_people_network_strength").using(
            "btree",
            table.userId.asc().nullsLast().op("uuid_ops"),
            table.networkStrength.asc().nullsLast().op("uuid_ops"),
        ),
        index("people_created_at_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
        index("people_starred_idx")
            .using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.starred.asc().nullsLast().op("uuid_ops"))
            .where(sql`(starred = true)`),
        index("people_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "people_user_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Users can view their own people", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
        pgPolicy("Users can insert their own people", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can update their own people", { as: "permissive", for: "update", to: ["public"] }),
        pgPolicy("Users can delete their own people", { as: "permissive", for: "delete", to: ["public"] }),
        check("people_category_check", sql`(category IS NULL) OR (category = ANY (ARRAY['Property Owner'::text, 'Lender'::text, 'Realtor'::text]))`),
        check("people_network_strength_check", sql`network_strength = ANY (ARRAY['HIGH'::text, 'MEDIUM'::text, 'LOW'::text])`),
    ],
);

export const peopleBoardAssignments = pgTable(
    "people_board_assignments",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        personId: uuid("person_id").notNull(),
        columnId: text("column_id").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
    },
    (table) => [
        index("people_board_assignments_column_id_idx").using("btree", table.columnId.asc().nullsLast().op("text_ops")),
        index("people_board_assignments_person_id_idx").using("btree", table.personId.asc().nullsLast().op("uuid_ops")),
        index("people_board_assignments_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.personId],
            foreignColumns: [people.id],
            name: "people_board_assignments_person_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "people_board_assignments_user_id_fkey",
        }).onDelete("cascade"),
        unique("people_board_assignments_user_id_person_id_column_id_key").on(table.userId, table.personId, table.columnId),
        pgPolicy("Users can view their own board assignments", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
        pgPolicy("Users can insert their own board assignments", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can update their own board assignments", { as: "permissive", for: "update", to: ["public"] }),
        pgPolicy("Users can delete their own board assignments", { as: "permissive", for: "delete", to: ["public"] }),
    ],
);

export const peopleGroups = pgTable(
    "people_groups",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        personId: uuid("person_id").notNull(),
        groupId: uuid("group_id").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
    },
    (table) => [
        index("people_groups_group_id_idx").using("btree", table.groupId.asc().nullsLast().op("uuid_ops")),
        index("people_groups_person_id_idx").using("btree", table.personId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.groupId],
            foreignColumns: [groups.id],
            name: "people_groups_group_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.personId],
            foreignColumns: [people.id],
            name: "people_groups_person_id_fkey",
        }).onDelete("cascade"),
        unique("unique_person_group").on(table.personId, table.groupId),
        pgPolicy("Users can view their people_groups", {
            as: "permissive",
            for: "select",
            to: ["public"],
            using: sql`(EXISTS ( SELECT 1
   FROM people
  WHERE ((people.id = people_groups.person_id) AND (people.user_id = auth.uid()))))`,
        }),
        pgPolicy("Users can insert their people_groups", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can delete their people_groups", { as: "permissive", for: "delete", to: ["public"] }),
    ],
);

export const peopleRelationships = pgTable(
    "people_relationships",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        personId: uuid("person_id").notNull(),
        relatedPersonId: uuid("related_person_id").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
    },
    (table) => [
        index("people_relationships_person_id_idx").using("btree", table.personId.asc().nullsLast().op("uuid_ops")),
        index("people_relationships_related_person_id_idx").using("btree", table.relatedPersonId.asc().nullsLast().op("uuid_ops")),
        index("people_relationships_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.personId],
            foreignColumns: [people.id],
            name: "people_relationships_person_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.relatedPersonId],
            foreignColumns: [people.id],
            name: "people_relationships_related_person_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "people_relationships_user_id_fkey",
        }).onDelete("cascade"),
        unique("unique_relationship").on(table.personId, table.relatedPersonId),
        pgPolicy("Users can view their own relationships", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
        pgPolicy("Users can insert their own relationships", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can delete their own relationships", { as: "permissive", for: "delete", to: ["public"] }),
        check("no_self_relationship", sql`person_id <> related_person_id`),
    ],
);

export const profiles = pgTable(
    "profiles",
    {
        id: uuid().primaryKey().notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }),
        fullName: text("full_name"),
        avatarUrl: text("avatar_url"),
        website: text(),
        roles: text().array(),
        isAdmin: boolean("is_admin").default(false).notNull(),
        themePreference: text("theme_preference").default("system"),
        newsletterActive: boolean("newsletter_active").default(false),
        newsletterInterests: text("newsletter_interests"),
        newsletterTimezone: text("newsletter_timezone").default("America/Los_Angeles"),
        newsletterPreferredSendTimes: jsonb("newsletter_preferred_send_times").default([]),
        newsletterSubscribedAt: timestamp("newsletter_subscribed_at", { withTimezone: true, mode: "string" }),
        subscriberId: uuid("subscriber_id"),
        tourVisitedPages: jsonb("tour_visited_pages").default([]),
    },
    (table) => [
        index("idx_profiles_newsletter_active").using("btree", table.newsletterActive.asc().nullsLast().op("bool_ops")),
        index("idx_profiles_subscriber_id").using("btree", table.subscriberId.asc().nullsLast().op("uuid_ops")),
        index("profiles_is_admin_idx")
            .using("btree", table.isAdmin.asc().nullsLast().op("bool_ops"))
            .where(sql`(is_admin = true)`),
        foreignKey({
            columns: [table.id],
            foreignColumns: [users.id],
            name: "profiles_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Users can insert their own profile.", { as: "permissive", for: "insert", to: ["public"], withCheck: sql`(auth.uid() = id)` }),
        pgPolicy("Users can update own profile.", { as: "permissive", for: "update", to: ["public"] }),
        pgPolicy("Public profiles are viewable by everyone.", { as: "permissive", for: "select", to: ["public"] }),
        check("profiles_theme_preference_check", sql`theme_preference = ANY (ARRAY['light'::text, 'dark'::text, 'system'::text])`),
    ],
);

export const rawLoopnetSearchScrapes = pgTable("raw_loopnet_search_scrapes", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    runId: text("run_id").notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true, mode: "string" }).notNull(),
    searchUrl: text("search_url").notNull(),
    rawJson: jsonb("raw_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const rawLoopnetDetailScrapes = pgTable("raw_loopnet_detail_scrapes", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    runId: text("run_id").notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true, mode: "string" }).notNull(),
    listingUrl: text("listing_url").notNull(),
    rawJson: jsonb("raw_json"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const rawBuildingDetails = pgTable("raw_building_details", {
    id: uuid().defaultRandom().primaryKey().notNull(),
    runId: text("run_id").notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true, mode: "string" }).notNull(),
    buildingZpid: text("building_zpid").notNull(),
    detailUrl: text("detail_url").notNull(),
    rawJson: jsonb("raw_json"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

export const sources = pgTable(
    "sources",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        sourceId: text("source_id").notNull(),
        sourceName: text("source_name").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
        url: text(),
        type: text(),
        disabled: boolean().default(false).notNull(),
        isNational: boolean("is_national").default(false).notNull(),
    },
    (table) => [
        index("idx_sources_source_id").using("btree", table.sourceId.asc().nullsLast().op("text_ops")),
        index("idx_sources_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
        unique("sources_source_id_key").on(table.sourceId),
    ],
);

export const subscribers = pgTable(
    "subscribers",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        email: text().notNull(),
        fullName: text("full_name").notNull(),
        subscribedAt: timestamp("subscribed_at", { withTimezone: true, mode: "string" }).defaultNow(),
        isActive: boolean("is_active").default(true),
        interests: text(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
        timezone: text(),
        preferredSendTimes: jsonb("preferred_send_times"),
    },
    (table) => [
        index("idx_subscribers_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
        index("idx_subscribers_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
        unique("subscribers_email_key").on(table.email),
    ],
);

export const zillowListings = pgTable(
    "zillow_listings",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        zpid: text(),
        detailUrl: text("detail_url"),
        address: text(),
        addressCity: text("address_city"),
        addressState: text("address_state"),
        addressStreet: text("address_street"),
        addressZipcode: text("address_zipcode"),
        buildingName: text("building_name"),
        area: text(),
        availabilityCount: text("availability_count"),
        availabilityDate: timestamp("availability_date", { precision: 6, withTimezone: true, mode: "string" }),
        baths: text(),
        beds: text(),
        price: text(),
        zestimate: text(),
        latitude: doublePrecision(),
        longitude: doublePrecision(),
        homeStatus: text("home_status"),
        homeType: text("home_type"),
        livingArea: text("living_area"),
        rentZestimate: text("rent_zestimate"),
        taxAssessedValue: text("tax_assessed_value"),
        daysOnZillow: text("days_on_zillow"),
        rawData: jsonb("raw_data"),
        createdAt: timestamp("created_at", { precision: 6, withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
        updatedAt: timestamp("updated_at", { precision: 6, withTimezone: true, mode: "string" }).default(sql`CURRENT_TIMESTAMP`),
        snapshotDate: timestamp("snapshot_date", { precision: 6, withTimezone: true, mode: "string" }).notNull(),
    },
    (table) => [
        index("idx_zillow_listings_detail_url").using("btree", table.detailUrl.asc().nullsLast().op("text_ops")),
        index("idx_zillow_listings_location").using(
            "btree",
            table.addressCity.asc().nullsLast().op("text_ops"),
            table.addressState.asc().nullsLast().op("text_ops"),
        ),
        index("idx_zillow_listings_snapshot_date").using("btree", table.snapshotDate.asc().nullsLast().op("timestamptz_ops")),
        index("idx_zillow_listings_zpid").using("btree", table.zpid.asc().nullsLast().op("text_ops")),
        uniqueIndex("idx_zillow_listings_zpid_snapshot").using(
            "btree",
            table.zpid.asc().nullsLast().op("text_ops"),
            table.snapshotDate.asc().nullsLast().op("text_ops"),
        ),
    ],
);

export const zipCodes = pgTable("zip_codes", {
    zip: text().primaryKey().notNull(),
    poName: text("po_name").notNull(),
    state: text().notNull(),
    active: boolean().default(true).notNull(),
    geom: geometry({ type: "multipolygon", srid: 4326 }),
    area: numeric(),
    length: numeric(),
});

export const articles = pgTable(
    "articles",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        link: text().notNull(),
        title: text().notNull(),
        date: timestamp({ withTimezone: true, mode: "string" }).notNull(),
        imageUrl: text("image_url"),
        description: text(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
        sourceId: text("source_id").notNull(),
        isCategorized: boolean("is_categorized").default(false).notNull(),
        isRelevant: boolean("is_relevant").default(true).notNull(),
    },
    (table) => [
        index("idx_articles_date").using("btree", table.date.asc().nullsLast().op("timestamptz_ops")),
        index("idx_articles_is_categorized").using("btree", table.isCategorized.asc().nullsLast().op("bool_ops")),
        index("idx_articles_is_relevant").using("btree", table.isRelevant.asc().nullsLast().op("bool_ops")),
        index("idx_articles_link").using("btree", table.link.asc().nullsLast().op("text_ops")),
        foreignKey({
            columns: [table.sourceId],
            foreignColumns: [sources.sourceId],
            name: "articles_source_id_fkey",
        }),
        unique("articles_link_key").on(table.link),
    ],
);

export const eventBlasts = pgTable(
    "event_blasts",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        eventId: uuid("event_id").notNull(),
        userId: uuid("user_id").notNull(),
        subject: text().notNull(),
        message: text().notNull(),
        recipientCount: integer("recipient_count").notNull(),
        sentCount: integer("sent_count").notNull(),
        failedCount: integer("failed_count").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
    },
    (table) => [
        index("idx_event_blasts_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
        index("idx_event_blasts_event_id").using("btree", table.eventId.asc().nullsLast().op("uuid_ops")),
        index("idx_event_blasts_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.eventId],
            foreignColumns: [events.id],
            name: "event_blasts_event_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "event_blasts_user_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Users can view blasts for their events", {
            as: "permissive",
            for: "select",
            to: ["public"],
            using: sql`(EXISTS ( SELECT 1
   FROM events
  WHERE ((events.id = event_blasts.event_id) AND (events.user_id = auth.uid()))))`,
        }),
        pgPolicy("Users can create blasts for their events", { as: "permissive", for: "insert", to: ["public"] }),
    ],
);

export const eventInvites = pgTable(
    "event_invites",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        eventId: uuid("event_id").notNull(),
        userId: uuid("user_id").notNull(),
        message: text(),
        recipientCount: integer("recipient_count").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
        recipientEmails: text("recipient_emails").array().default([""]),
    },
    (table) => [
        index("idx_event_invites_created_at").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
        index("idx_event_invites_event_id").using("btree", table.eventId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.eventId],
            foreignColumns: [events.id],
            name: "event_invites_event_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "event_invites_user_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Event owners can view event invites", {
            as: "permissive",
            for: "select",
            to: ["public"],
            using: sql`(EXISTS ( SELECT 1
   FROM events e
  WHERE ((e.id = event_invites.event_id) AND (e.user_id = auth.uid()))))`,
        }),
        pgPolicy("Event owners can insert event invites", { as: "permissive", for: "insert", to: ["public"] }),
    ],
);

export const eventRegistrations = pgTable(
    "event_registrations",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        eventId: uuid("event_id").notNull(),
        userId: uuid("user_id").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
    },
    (table) => [
        index("event_registrations_event_id_idx").using("btree", table.eventId.asc().nullsLast().op("uuid_ops")),
        index("event_registrations_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.eventId],
            foreignColumns: [events.id],
            name: "event_registrations_event_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "event_registrations_user_id_fkey",
        }).onDelete("cascade"),
        unique("event_registrations_event_id_user_id_key").on(table.eventId, table.userId),
        pgPolicy("Users can view event registrations", {
            as: "permissive",
            for: "select",
            to: ["public"],
            using: sql`((auth.uid() = user_id) OR (auth.uid() IN ( SELECT events.user_id
   FROM events
  WHERE (events.id = event_registrations.event_id))))`,
        }),
        pgPolicy("Users can register for events", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can unregister from events", { as: "permissive", for: "delete", to: ["public"] }),
    ],
);

export const interactions = pgTable(
    "interactions",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        personId: uuid("person_id"),
        integrationId: uuid("integration_id"),
        interactionType: text("interaction_type").notNull(),
        subject: text(),
        occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).notNull(),
        metadata: jsonb().default({}),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
    },
    (table) => [
        index("idx_interactions_occurred_at").using("btree", table.occurredAt.desc().nullsFirst().op("timestamptz_ops")),
        index("idx_interactions_person_id").using("btree", table.personId.asc().nullsLast().op("uuid_ops")),
        uniqueIndex("idx_interactions_unique_calendar")
            .using("btree", sql`user_id`, sql`person_id`, sql`((metadata ->> 'event_id'::text))`)
            .where(sql`((metadata ->> 'event_id'::text) IS NOT NULL)`),
        uniqueIndex("idx_interactions_unique_email")
            .using("btree", sql`user_id`, sql`person_id`, sql`((metadata ->> 'message_id'::text))`)
            .where(sql`((metadata ->> 'message_id'::text) IS NOT NULL)`),
        index("idx_interactions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.integrationId],
            foreignColumns: [integrations.id],
            name: "interactions_integration_id_fkey",
        }).onDelete("set null"),
        foreignKey({
            columns: [table.personId],
            foreignColumns: [people.id],
            name: "interactions_person_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [users.id],
            name: "interactions_user_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Users can view their own interactions", { as: "permissive", for: "select", to: ["public"], using: sql`(auth.uid() = user_id)` }),
        pgPolicy("Users can insert their own interactions", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can update their own interactions", { as: "permissive", for: "update", to: ["public"] }),
        pgPolicy("Users can delete their own interactions", { as: "permissive", for: "delete", to: ["public"] }),
    ],
);

export const newsletters = pgTable(
    "newsletters",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        subscriberEmail: text("subscriber_email").notNull(),
        status: text().default("draft").notNull(),
        sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
        campaignId: text("campaign_id"),
        subject: text(),
        scheduledSendAt: timestamp("scheduled_send_at", { withTimezone: true, mode: "string" }),
    },
    (table) => [
        index("idx_newsletters_campaign_id").using("btree", table.campaignId.asc().nullsLast().op("text_ops")),
        index("idx_newsletters_scheduled_send_at").using("btree", table.scheduledSendAt.asc().nullsLast().op("timestamptz_ops")),
        index("idx_newsletters_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
        index("idx_newsletters_status_scheduled").using(
            "btree",
            table.status.asc().nullsLast().op("text_ops"),
            table.scheduledSendAt.asc().nullsLast().op("timestamptz_ops"),
        ),
        index("idx_newsletters_subscriber_email").using("btree", table.subscriberEmail.asc().nullsLast().op("text_ops")),
        foreignKey({
            columns: [table.subscriberEmail],
            foreignColumns: [subscribers.email],
            name: "newsletters_subscriber_email_fkey",
        }),
    ],
);

export const posts = pgTable(
    "posts",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        userId: uuid("user_id").notNull(),
        type: text().default("post"),
        content: text().notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        fileUrl: text("file_url"),
    },
    (table) => [
        index("posts_created_at_idx").using("btree", table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
        index("posts_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [profiles.id],
            name: "posts_user_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Posts are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
        pgPolicy("Users can update their own posts", { as: "permissive", for: "update", to: ["public"] }),
        pgPolicy("Users can delete their own posts", { as: "permissive", for: "delete", to: ["public"] }),
        pgPolicy("Users can insert their own posts or admins can insert for other", { as: "permissive", for: "insert", to: ["public"] }),
        check("posts_type_check", sql`type = ANY (ARRAY['post'::text, 'article'::text, 'link'::text])`),
    ],
);

export const rawZillowScrapes = pgTable(
    "raw_zillow_scrapes",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        zipCode: text("zip_code").notNull(),
        scrapedAt: timestamp("scraped_at", { withTimezone: true, mode: "string" }).notNull(),
        runId: text("run_id").notNull(),
        rawJson: jsonb("raw_json").notNull(),
    },
    (table) => [
        index("raw_zillow_scrapes_zip_scraped_at_idx").using(
            "btree",
            table.zipCode.asc().nullsLast().op("text_ops"),
            table.scrapedAt.desc().nullsFirst().op("text_ops"),
        ),
        foreignKey({
            columns: [table.zipCode],
            foreignColumns: [zipCodes.zip],
            name: "raw_zillow_scrapes_zip_code_fkey",
        }),
    ],
);

export const subscriberCities = pgTable(
    "subscriber_cities",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        subscriberId: uuid("subscriber_id").notNull(),
        cityId: uuid("city_id").notNull(),
    },
    (table) => [
        index("idx_subscriber_cities_city_id").using("btree", table.cityId.asc().nullsLast().op("uuid_ops")),
        index("idx_subscriber_cities_subscriber_id").using("btree", table.subscriberId.asc().nullsLast().op("uuid_ops")),
        uniqueIndex("subscriber_cities_subscriber_id_city_id_key").using(
            "btree",
            table.subscriberId.asc().nullsLast().op("uuid_ops"),
            table.cityId.asc().nullsLast().op("uuid_ops"),
        ),
        foreignKey({
            columns: [table.cityId],
            foreignColumns: [cities.id],
            name: "subscriber_cities_city_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.subscriberId],
            foreignColumns: [subscribers.id],
            name: "subscriber_cities_subscriber_id_fkey",
        }).onDelete("cascade"),
    ],
);

export const subscriberCounties = pgTable(
    "subscriber_counties",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        subscriberId: uuid("subscriber_id").notNull(),
        countyId: uuid("county_id").notNull(),
    },
    (table) => [
        index("idx_subscriber_counties_county_id").using("btree", table.countyId.asc().nullsLast().op("uuid_ops")),
        index("idx_subscriber_counties_subscriber_id").using("btree", table.subscriberId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.countyId],
            foreignColumns: [counties.id],
            name: "subscriber_counties_county_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.subscriberId],
            foreignColumns: [subscribers.id],
            name: "subscriber_counties_subscriber_id_fkey",
        }).onDelete("cascade"),
        unique("subscriber_counties_subscriber_id_county_id_key").on(table.subscriberId, table.countyId),
    ],
);

export const subscriberOtherLocations = pgTable(
    "subscriber_other_locations",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        subscriberId: uuid("subscriber_id").notNull(),
        location: text().notNull(),
    },
    (table) => [
        index("idx_subscriber_other_locations_location").using("btree", table.location.asc().nullsLast().op("text_ops")),
        index("idx_subscriber_other_locations_subscriber_id").using("btree", table.subscriberId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.subscriberId],
            foreignColumns: [subscribers.id],
            name: "subscriber_other_locations_subscriber_id_fkey",
        }).onDelete("cascade"),
        unique("subscriber_other_locations_subscriber_id_location_key").on(table.subscriberId, table.location),
    ],
);

export const articleCities = pgTable(
    "article_cities",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        articleId: uuid("article_id").notNull(),
        city: text().notNull(),
    },
    (table) => [
        index("idx_article_cities_article_id").using("btree", table.articleId.asc().nullsLast().op("uuid_ops")),
        index("idx_article_cities_city").using("btree", table.city.asc().nullsLast().op("text_ops")),
        foreignKey({
            columns: [table.articleId],
            foreignColumns: [articles.id],
            name: "article_cities_article_id_fkey",
        }).onDelete("cascade"),
        unique("article_cities_article_id_city_key").on(table.articleId, table.city),
    ],
);

export const articleCounties = pgTable(
    "article_counties",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        articleId: uuid("article_id").notNull(),
        countyId: uuid("county_id").notNull(),
    },
    (table) => [
        index("idx_article_counties_article_id").using("btree", table.articleId.asc().nullsLast().op("uuid_ops")),
        index("idx_article_counties_county_id").using("btree", table.countyId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.articleId],
            foreignColumns: [articles.id],
            name: "article_counties_article_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.countyId],
            foreignColumns: [counties.id],
            name: "article_counties_county_id_fkey",
        }).onDelete("cascade"),
        unique("article_counties_article_id_county_id_key").on(table.articleId, table.countyId),
    ],
);

export const articleTags = pgTable(
    "article_tags",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        articleId: uuid("article_id").notNull(),
        tag: text().notNull(),
    },
    (table) => [
        index("idx_article_tags_article_id").using("btree", table.articleId.asc().nullsLast().op("uuid_ops")),
        index("idx_article_tags_tag").using("btree", table.tag.asc().nullsLast().op("text_ops")),
        foreignKey({
            columns: [table.articleId],
            foreignColumns: [articles.id],
            name: "article_tags_article_id_fkey",
        }).onDelete("cascade"),
        unique("article_tags_article_id_tag_key").on(table.articleId, table.tag),
    ],
);

export const cleanedListings = pgTable(
    "cleaned_listings",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        runId: text("run_id").notNull(),
        scrapedAt: timestamp("scraped_at", { withTimezone: true, mode: "string" }).notNull(),
        zipCode: text("zip_code").notNull(),
        zpid: text().notNull(),
        addressRaw: text("address_raw"),
        addressStreet: text("address_street"),
        addressCity: text("address_city"),
        addressState: text("address_state"),
        addressZip: text("address_zip"),
        price: integer(),
        beds: integer(),
        baths: numeric(),
        area: integer(),
        availabilityDate: date("availability_date"),
        geom: geometry({ type: "point", srid: 4326 }),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow(),
        rawScrapeId: uuid("raw_scrape_id"),
        latitude: doublePrecision().generatedAlwaysAs(sql`st_y(geom)`),
        longitude: doublePrecision().generatedAlwaysAs(sql`st_x(geom)`),
        imgSrc: text("img_src"),
        detailUrl: text("detail_url"),
        isBuilding: boolean("is_building").default(false),
        buildingZpid: text("building_zpid"),
        homeType: text("home_type"),
        laundry: text(),
    },
    (table) => [
        index("cleaned_listings_geom_idx").using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d")),
        index("cleaned_listings_zip_run_idx").using("btree", table.zipCode.asc().nullsLast().op("text_ops"), table.runId.asc().nullsLast().op("text_ops")),
        index("idx_cleaned_listings_city_state_lower").using("btree", sql`lower(address_city)`, sql`lower(address_state)`),
        index("idx_cleaned_listings_geom")
            .using("gist", table.geom.asc().nullsLast().op("gist_geometry_ops_2d"))
            .where(sql`(geom IS NOT NULL)`),
        index("idx_cleaned_listings_run_id_desc").using("btree", table.runId.desc().nullsFirst().op("text_ops")),
        foreignKey({
            columns: [table.rawScrapeId],
            foreignColumns: [rawZillowScrapes.id],
            name: "cleaned_listings_raw_scrape_id_fkey",
        }),
        foreignKey({
            columns: [table.zipCode],
            foreignColumns: [zipCodes.zip],
            name: "cleaned_listings_zip_code_fkey",
        }),
        unique("cleaned_listings_zpid_run_id_key").on(table.runId, table.zpid),
        check("cleaned_listings_laundry_check", sql`laundry = ANY (ARRAY['in_unit'::text, 'shared'::text, 'none'::text])`),
    ],
);

export const comments = pgTable(
    "comments",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        postId: uuid("post_id").notNull(),
        userId: uuid("user_id").notNull(),
        content: text().notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
    },
    (table) => [
        index("comments_post_id_idx").using("btree", table.postId.asc().nullsLast().op("uuid_ops")),
        index("comments_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.postId],
            foreignColumns: [posts.id],
            name: "comments_post_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [profiles.id],
            name: "comments_user_id_fkey",
        }).onDelete("cascade"),
        pgPolicy("Comments are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
        pgPolicy("Users can insert their own comments", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can update their own comments", { as: "permissive", for: "update", to: ["public"] }),
        pgPolicy("Users can delete their own comments", { as: "permissive", for: "delete", to: ["public"] }),
    ],
);

export const likes = pgTable(
    "likes",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        postId: uuid("post_id").notNull(),
        userId: uuid("user_id").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
            .default(sql`timezone('utc'::text, now())`)
            .notNull(),
    },
    (table) => [
        index("likes_post_id_idx").using("btree", table.postId.asc().nullsLast().op("uuid_ops")),
        index("likes_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.postId],
            foreignColumns: [posts.id],
            name: "likes_post_id_fkey",
        }).onDelete("cascade"),
        foreignKey({
            columns: [table.userId],
            foreignColumns: [profiles.id],
            name: "likes_user_id_fkey",
        }).onDelete("cascade"),
        unique("likes_post_id_user_id_key").on(table.postId, table.userId),
        pgPolicy("Likes are viewable by everyone", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
        pgPolicy("Users can insert their own likes", { as: "permissive", for: "insert", to: ["public"] }),
        pgPolicy("Users can delete their own likes", { as: "permissive", for: "delete", to: ["public"] }),
    ],
);

export const newsletterArticles = pgTable(
    "newsletter_articles",
    {
        id: uuid().defaultRandom().primaryKey().notNull(),
        newsletterId: uuid("newsletter_id").notNull(),
        articleId: uuid("article_id").notNull(),
    },
    (table) => [
        index("idx_newsletter_articles_article_id").using("btree", table.articleId.asc().nullsLast().op("uuid_ops")),
        index("idx_newsletter_articles_newsletter_id").using("btree", table.newsletterId.asc().nullsLast().op("uuid_ops")),
        foreignKey({
            columns: [table.articleId],
            foreignColumns: [articles.id],
            name: "newsletter_articles_article_id_fkey",
        }),
        foreignKey({
            columns: [table.newsletterId],
            foreignColumns: [newsletters.id],
            name: "newsletter_articles_newsletter_id_fkey",
        }).onDelete("cascade"),
        unique("newsletter_articles_newsletter_id_article_id_key").on(table.newsletterId, table.articleId),
    ],
);

// ─────────────────────────────────────────────────────────────────────────────
// Materialized views — unit breakdown by building (OPE-116)
// ─────────────────────────────────────────────────────────────────────────────

/** Unit mix for the most-recent scrape run only (p_latest_only = true). */
export const mvUnitBreakdownLatest = pgMaterializedView("mv_unit_breakdown_latest", {
    buildingZpid: text("building_zpid").notNull(),
    unitCount: integer("unit_count").notNull(),
    unitMix: jsonb("unit_mix").notNull(),
}).existing();

/** Unit mix across all scrape runs, deduplicated per zpid (p_latest_only = false). */
export const mvUnitBreakdownHistorical = pgMaterializedView("mv_unit_breakdown_historical", {
    buildingZpid: text("building_zpid").notNull(),
    unitCount: integer("unit_count").notNull(),
    unitMix: jsonb("unit_mix").notNull(),
}).existing();
