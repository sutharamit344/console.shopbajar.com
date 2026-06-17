import { storage } from "./firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { compressImage } from "./imageCompressor";

/**
 * Uploads an image to Firebase Storage and returns the download URL.
 * Automatically compresses images to 500KB - 1MB range before upload.
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  try {
    // Apply client-side compression only for images
    let processedFile: File | Blob = file;
    if (file && file.type && file.type.startsWith("image/")) {
      processedFile = await compressImage(file);
    }
    
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, processedFile);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Error uploading image: ", error);
    throw error;
  }
}
