// src/lib/upload.ts
import { createBrowserClient } from "@/lib/supabase/client";

export async function uploadFacilityImage(
  file: File,
  folder: string 
): Promise<string> {
  const supabase = createBrowserClient();

  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${folder}/${filename}`; // no bucket name here

  const { error } = await supabase.storage
    .from("facilities") // this is the bucket
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from("facilities").getPublicUrl(path);
  return data.publicUrl;
}
