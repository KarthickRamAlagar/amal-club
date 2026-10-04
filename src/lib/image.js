import imageCompression from "browser-image-compression";

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
export const cloudinaryReady = Boolean(CLOUD && PRESET);

const PRESETS = {
  avatar: { maxWidthOrHeight: 800, maxSizeMB: 0.35 },
  banner: { maxWidthOrHeight: 2000, maxSizeMB: 0.9 },
  poster: { maxWidthOrHeight: 2160, maxSizeMB: 1.6 },
  logo: { maxWidthOrHeight: 600, maxSizeMB: 0.25 },
  proof: { maxWidthOrHeight: 1400, maxSizeMB: 0.5 },
};

/** Compress to WebP keeping visual quality (high initialQuality, resize only when larger than needed). */
export async function compressImage(file, kind = "banner") {
  if (!file?.type?.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.type === "image/svg+xml") return file;
  const p = PRESETS[kind] || PRESETS.banner;
  return imageCompression(file, {
    ...p, useWebWorker: true, fileType: "image/webp", initialQuality: 0.88, alwaysKeepResolution: false,
  });
}

/** Upload to Cloudinary (unsigned preset). Only the returned public https URL is stored in Firestore. */
export async function uploadImage(fileOrBlob, { kind = "banner", folder = "amal" } = {}) {
  if (!cloudinaryReady) throw new Error("Image uploads need VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.");
  const file = fileOrBlob instanceof File ? await compressImage(fileOrBlob, kind)
    : await compressImage(new File([fileOrBlob], `${kind}.png`, { type: fileOrBlob.type || "image/png" }), kind);
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", PRESET);
  body.append("folder", `${folder}/${kind}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: "POST", body });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Upload failed");
  return json.secure_url;
}

/** Cloudinary delivery transform (auto format/quality) for display. */
export function cdn(url, w) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto${w ? `,w_${w}` : ""}/`);
}

export const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob();
