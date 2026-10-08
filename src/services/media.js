import { collection, doc, query, where, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { actorSnap } from "@/lib/permissions";
import { compressImage } from "@/lib/image";
import { logInBatch } from "./logs";

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
export const MAX_VIDEO_MB = 100;  // Cloudinary free plan per-video limit
export const MAX_IMAGE_MB = 10;   // Cloudinary free plan per-image limit

/**
 * Uploads a poster/video to Cloudinary (unsigned preset) with progress.
 * `source` is a File/Blob, or an https URL (Cloudinary fetches it — used for Canva exports).
 * Returns { url, width, height, bytes, duration, format, resourceType }.
 */
export function uploadMediaFile(source, { kind = "poster", eventId = "general", onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (!CLOUD || !PRESET) return reject(new Error("Uploads need VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET."));
    const body = new FormData();
    body.append("file", source);
    body.append("upload_preset", PRESET);
    body.append("folder", `amal/media/${eventId}`);
    const type = kind === "video" ? "video" : typeof source === "string" ? "auto" : "image"; // PDFs upload as images too
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD}/${type}/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    xhr.onload = () => {
      let j = {}; try { j = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 300) return reject(new Error(j?.error?.message || `Upload failed (${xhr.status})`));
      resolve({ url: j.secure_url, width: j.width || null, height: j.height || null, bytes: j.bytes || null, duration: j.duration || null, format: j.format || "", resourceType: j.resource_type });
    };
    xhr.send(body);
  });
}

/** Big phone photos are squeezed (WebP, still sharp) only when over the free-plan image limit. */
export async function prepareImage(file) {
  if (file.size <= (MAX_IMAGE_MB - 0.5) * 1048576 || file.type === "application/pdf") return file;
  return compressImage(file, "poster");
}

/** Poster frame for a Cloudinary video (first second, JPG). */
export function videoThumb(url, w = 640) {
  if (!url?.includes("/video/upload/")) return "";
  return url.replace("/video/upload/", `/video/upload/so_1,w_${w},c_limit,f_jpg/`).replace(/\.[a-z0-9]+$/i, ".jpg");
}

export const mediaForEvent = (eventId, { publicOnly = false } = {}) => {
  const base = [collection(db, "media"), where("eventId", "==", eventId)];
  return publicOnly ? query(...base, where("visibility", "==", "public"), where("status", "==", "active")) : query(...base);
};

/** Saves the Cloudinary URL + metadata to the event (the editable source stays in Canva / the member's device). */
export async function saveMedia(me, ev, data) {
  const batch = writeBatch(db);
  const ref = doc(collection(db, "media"));
  const row = {
    id: ref.id, eventId: ev.slug, eventName: ev.name,
    kind: data.kind, source: data.source, format: data.format || "", title: (data.title || "").slice(0, 120),
    url: data.url, thumbUrl: data.thumbUrl || (data.kind === "video" ? videoThumb(data.url) : data.url),
    width: data.width || null, height: data.height || null, bytes: data.bytes || null, duration: data.duration || null,
    fileType: data.fileType || "", canva: data.canva || null, editor: data.editor || null,
    visibility: data.visibility === "internal" ? "internal" : "public", status: "active",
    createdBy: actorSnap(me), createdAt: serverTimestamp(),
  };
  batch.set(ref, row);
  logInBatch(batch, { scope: "media", type: "media.save", actor: me, target: { id: ev.slug, name: ev.name }, details: { mediaId: ref.id, kind: data.kind, source: data.source, title: row.title } });
  await batch.commit();
  return ref.id;
}

export async function updateMedia(me, m, patch, type) {
  const batch = writeBatch(db);
  batch.update(doc(db, "media", m.id), { ...patch, updatedBy: actorSnap(me), updatedAt: serverTimestamp() });
  logInBatch(batch, { scope: "media", type, actor: me, target: { id: m.eventId, name: m.eventName }, details: { mediaId: m.id, kind: m.kind, title: m.title } });
  await batch.commit();
}
