/**
 * Client-side image compressor using Canvas API.
 * Targets a specific file size range (default 500KB - 1MB).
 */
export async function compressImage(file: File, minSizeKB = 500, maxSizeKB = 1000): Promise<File> {
  // 1. Skip if file is already in or below the target range
  if (file.size / 1024 <= maxSizeKB) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event: any) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // 2. Cap maximum dimension to ~2400px (High Res but manageable)
        const MAX_WIDTH = 2400;
        const MAX_HEIGHT = 2400;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get 2d context for image compression"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        /**
         * Iterative quality adjustment to stay within 500KB - 1MB
         * Starting at 0.9 quality
         */
        const targetMax = maxSizeKB * 1024;
        
        const getBlob = (q: number): Promise<Blob | null> => {
          return new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
        };

        (async () => {
          try {
            // First pass at 0.85
            let quality = 0.85;
            let blob = await getBlob(quality);
            if (!blob) throw new Error("Blob conversion failed");

            // If still over 1MB, drop quality and try once more
            if (blob.size > targetMax) {
              quality = 0.75;
              blob = await getBlob(quality);
              if (!blob) throw new Error("Blob conversion failed");
            }
            
            // If still over 1MB, drop quality to 0.6 (last resort for huge images)
            if (blob.size > targetMax) {
              quality = 0.6;
              blob = await getBlob(quality);
              if (!blob) throw new Error("Blob conversion failed");
            }

            // Wrap as a File object to maintain original filename/type properties if needed
            const compressedFile = new File([blob], file.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          } catch (err) {
            reject(err);
          }
        })();
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
