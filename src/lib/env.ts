import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  RESEND_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().optional().default("gemini-2.0-flash"),
  NEXT_PUBLIC_SITE_URL: z.string().optional().default("http://localhost:3000"),
});

// Only validate strictly on the server at runtime, not during static build
const getEnv = () => {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((err) => `  ${err.path.join(".")}: ${err.message}`)
      .join("\n");
    throw new Error(
      `[Env Validation Error] Missing or invalid environment variables:\n${errorMessages}\n\nPlease check your .env.local file or Vercel Environment Variables.`
    );
  }

  return result.data;
};

export const env = getEnv();
