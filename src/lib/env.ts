import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  RESEND_API_KEY: typeof window === "undefined"
    ? z.string().min(1, "RESEND_API_KEY is required on server")
    : z.string().optional(),
});

const getEnv = () => {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  });

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((err) => `${err.path.join(".")}: ${err.message}`)
      .join("\n");
    throw new Error(
      `[Env Validation Error] Missing or invalid environment variables:\n${errorMessages}\n\nPlease check your .env.local file.`
    );
  }

  return result.data;
};

export const env = getEnv();
