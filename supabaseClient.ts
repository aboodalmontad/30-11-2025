// Fix: Use `import type` for SupabaseClient as it is used as a type, not a value. This resolves module resolution errors in some environments.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Hardcoded Supabase credentials provided by the user.
const supabaseUrl = "https://gvafdhyudvdymletqjee.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2YWZkaHl1ZHZkeW1sZXRxamVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MzA0NzYsImV4cCI6MjA3NzUwNjQ3Nn0.PuoD-Mayi8cTscKG9CuQWA_qQU8x8lCeprI63jh5qCE";

// Singleton instance of the Supabase client.
let supabase: SupabaseClient | null = null;

/**
 * Creates or retrieves a singleton Supabase client instance using hardcoded credentials.
 * @returns A Supabase client instance. Returns null if initialization fails.
 */
export function getSupabaseClient(): SupabaseClient | null {
    // If the client is already initialized, return it.
    if (supabase) {
        return supabase;
    }
    
    // If hardcoded credentials are not valid, return null.
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Supabase credentials are not defined in the code.");
        return null;
    }

    // Create a new client instance.
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
        return supabase;
    } catch (error) {
        console.error("Error creating Supabase client:", error);
        supabase = null; // Ensure supabase is null on failure
        return null;
    }
}
