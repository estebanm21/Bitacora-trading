import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hqgknaoblybyvhpoiwjp.supabase.co' 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxZ2tuYW9ibHlieXZocG9pd2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI0OTk4NjgsImV4cCI6MjA3ODA3NTg2OH0.Mx7ytPRMZSfSK-XgeGBvBfnPkKZ3pN-wnFHhCES5TpQ'

export const supabase = createClient(supabaseUrl, supabaseKey)