import { fal } from "@fal-ai/client";
import { NextRequest, NextResponse } from "next/server";

fal.config({ credentials: process.env.FAL_KEY });

interface OutputResult {
  type: "video" | "image" | "audio" | "3d";
  url: string;
  urls?: string[];
}

// Extracts the output URL from fal.ai's varied response shapes
function extractOutput(data: unknown): OutputResult | null {
  const d = data as Record<string, unknown>;

  // Video
  const video = d?.video as Record<string, unknown> | undefined;
  if (typeof video?.url === "string") return { type: "video", url: video.url };

  // Images array (most image models)
  if (Array.isArray(d?.images) && (d.images as unknown[]).length > 0) {
    const imgs = d.images as Array<{ url: string }>;
    const urls = imgs.map((i) => i.url).filter(Boolean);
    if (urls.length > 0) return { type: "image", url: urls[0], urls };
  }

  // Single image
  const image = d?.image as Record<string, unknown> | undefined;
  if (typeof image?.url === "string") return { type: "image", url: image.url };

  // Audio (various shapes)
  const audioSources = [d?.audio, d?.audio_file, d?.audio_url] as Array<
    Record<string, unknown> | string | undefined
  >;
  for (const src of audioSources) {
    if (typeof src === "string") return { type: "audio", url: src };
    if (src && typeof (src as Record<string, unknown>).url === "string")
      return { type: "audio", url: (src as Record<string, unknown>).url as string };
  }

  // 3D mesh (various shapes)
  const meshSources = [d?.model_mesh, d?.mesh, d?.glb, d?.model] as Array<
    Record<string, unknown> | undefined
  >;
  for (const src of meshSources) {
    if (src && typeof (src as Record<string, unknown>).url === "string")
      return { type: "3d", url: (src as Record<string, unknown>).url as string };
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.FAL_KEY) {
      return NextResponse.json(
        { error: "FAL_KEY is not configured. Add it in Vercel → Settings → Environment Variables." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { model, ...input } = body;

    if (!model) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }

    const result = await fal.subscribe(model, { input });
    const raw = (result as { data?: unknown }).data ?? result;
    const output = extractOutput(raw);

    if (!output) {
      // Return the raw result so you can inspect the shape and extend extractOutput above
      return NextResponse.json(
        { error: "Could not extract output URL from model response", raw },
        { status: 422 }
      );
    }

    return NextResponse.json({ output });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
