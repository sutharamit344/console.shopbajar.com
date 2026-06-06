import React, { useState } from "react";
import { X, Loader2, Plus } from "lucide-react";
import { uploadImage } from "../../lib/storage";
import { useModal } from "../../hooks/useModal";

interface ImageUploadProps {
  onUpload?: (url: string | string[]) => void;
  onSelect?: (file: any) => void;
  label?: string;
  folder?: string;
  currentImage?: string | null;
  compact?: boolean;
  multiple?: boolean;
  className?: string;
  helpText?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onUpload,
  onSelect,
  label,
  folder = "general",
  currentImage = null,
  compact = false,
  multiple = false,
  className = "",
  helpText
}) => {
  const { showAlert } = useModal();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<any>(currentImage);

  React.useEffect(() => {
    setPreview(currentImage);
  }, [currentImage]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length === 0) return;

    if (multiple && onSelect) {
      onSelect(files);
      e.target.value = "";
      return;
    }

    if (multiple && onUpload) {
      setUploading(true);
      try {
        const uploadedUrls: string[] = [];
        for (const file of files) {
          const fileName = `${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
          const path = `uploads/${folder}/${fileName}`;
          const url = await uploadImage(file, path);
          uploadedUrls.push(url);
        }
        onUpload(uploadedUrls);
      } catch (error) {
        console.error(error);
        showAlert({
          title: "Upload Failed",
          message: "We encountered an issue while uploading your images. Please try again.",
          type: "error"
        });
      } finally {
        setUploading(false);
        e.target.value = "";
      }
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);

    if (onSelect) {
      onSelect(file);
      return;
    }

    try {
      setUploading(true);
      const fileName = `${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, '_').toLowerCase()}`;
      const path = `uploads/${folder}/${fileName}`;
      const url = await uploadImage(file, path);
      onUpload(url);
      setPreview(null);
    } catch (error) {
      console.error(error);
      showAlert({
        title: "Upload Failed",
        message: "We encountered an issue while uploading your image. Please try again.",
        type: "error"
      });
      setPreview(currentImage);
    } finally {
      setUploading(false);
    }
  };

  const clearImage = () => {
    setPreview(null);
    if (onSelect) onSelect(null);
    if (onUpload) onUpload("");
  };

  const heightClass = className.includes('h-') || className.includes('w-') ? "" : (compact ? "h-16 w-16" : "h-24 w-24");
  const containerClass = "rounded-md";

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-[10px] font-bold text-[#0A0A0F]/30 dark:text-zinc-500 uppercase tracking-[0.1em] px-1">
          {label}
        </label>
      )}

      <div className="relative group flex items-center justify-center">
        {preview ? (
          <div className={`relative ${heightClass} ${containerClass} ${className} overflow-hidden border border-black/[0.08] dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm`}>
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-1 right-1 w-6 h-6 bg-[#0A0A0F]/60 backdrop-blur-md rounded-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 shadow-xl cursor-pointer"
            >
              <X size={12} />
            </button>
            {uploading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-zinc-900/60 flex items-center justify-center backdrop-blur-sm">
                <Loader2 size={16} className="text-[#FF6A00] animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <label className={`flex flex-col items-center justify-center ${heightClass} ${containerClass} ${className} border border-dashed border-black/[0.08] dark:border-zinc-800 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] hover:border-[#FF6A00]/40 dark:hover:border-[#FF6A00]/40 transition-all cursor-pointer group shadow-sm`}>
            <div className="flex flex-col items-center justify-center px-3 text-center">
              {uploading ? (
                <Loader2 size={16} className="text-[#FF6A00] animate-spin" />
              ) : (
                <>
                  <Plus size={16} className="text-[#0A0A0F]/20 dark:text-zinc-700 group-hover:text-[#FF6A00] transition-colors" />
                  {!compact && (
                    <p className="text-[10px] text-[#0A0A0F]/20 dark:text-zinc-650 font-bold uppercase tracking-widest mt-1">Upload</p>
                  )}
                </>
              )}
            </div>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              multiple={multiple}
            />
          </label>
        )}
      </div>
      {helpText && (
        <p className="text-[10px] font-medium text-zinc-450 dark:text-zinc-500 mt-1 px-1">
          {helpText}
        </p>
      )}
    </div>
  );
};

export default ImageUpload;
