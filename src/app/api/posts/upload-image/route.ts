import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate user session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const postId = formData.get("postId") as string | null;

    if (!file || !postId) {
      return NextResponse.json(
        { error: "Missing file or postId" },
        { status: 400 }
      );
    }

    // 3. Client + Server validation on mime type and file size
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid image format. Allowed formats: JPEG, PNG, WEBP, GIF, SVG." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Image exceeds 10MB limit." },
        { status: 400 }
      );
    }

    // 4. Generate path matching {userId}/{postId}/{uuid}.{ext}
    const fileExt = file.name.split(".").pop() || "png";
    const uuid = crypto.randomUUID();
    const filePath = `${user.id}/${postId}/${uuid}.${fileExt}`;

    // 5. Convert file data to ArrayBuffer -> Buffer for upload
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 6. Get Public URL
    const { data: publicUrlData } = supabase.storage
      .from("post-images")
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrlData.publicUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Upload Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
