# Database

All database changes must be version controlled here. Do not make schema or function changes directly in the Supabase dashboard without also committing the corresponding SQL here.

## Structure

```
supabase/
├── migrations/   # Ordered history of all schema + function changes
└── functions/    # Current definition of every custom Postgres function
```

## Making a schema change

1. Create a new file in `migrations/` with the next number: `012_<description>.sql`
2. Write your DDL (`CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`, etc.) using `IF NOT EXISTS` / `IF EXISTS` where possible so it's safe to re-run
3. Apply it in the Supabase dashboard under **SQL Editor**, or via `supabase db push`
4. Commit the migration file

## Making a function change

1. Edit the relevant file in `functions/<function_name>.sql`
2. Create a new migration in `migrations/` with the same `CREATE OR REPLACE FUNCTION` — this is what actually runs against the DB
3. Apply the migration in Supabase
4. Commit both files together

The `functions/` files are the readable source of truth for what each function currently does. The `migrations/` files are the authoritative change history.

## Applying migrations to a fresh DB

Run the migration files in order (001 → latest) against the target database.
