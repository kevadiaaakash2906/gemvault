export const MAX_MAIN_BYTES = 1_500_000;   // the website shrinks photos before sending, so real ones are far smaller
export const MAX_THUMB_BYTES = 150_000;

export function detectImageType(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  const at = (i: number) => bytes[i];
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return "jpeg";
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return "png";
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return "webp";
  return null;
}

export const IMAGE_MIME: Record<string, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const IMAGE_EXT: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp" };
