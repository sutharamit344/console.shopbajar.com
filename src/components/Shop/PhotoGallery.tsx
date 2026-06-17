import React from "react";
import { Image as ImageIcon, X } from "lucide-react";
import ImageUpload from "../UI/ImageUpload";

const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  if (url.startsWith("data:")) {
    return url.startsWith("data:video/");
  }
  const pathPart = url.split("?")[0].toLowerCase();
  return (
    pathPart.endsWith(".mp4") ||
    pathPart.endsWith(".webm") ||
    pathPart.endsWith(".ogg") ||
    pathPart.endsWith(".mov") ||
    pathPart.endsWith(".m4v") ||
    pathPart.endsWith(".quicktime")
  );
};

interface PhotoGalleryProps {
  shopId: string;
  gallery: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdateShop: (updateData: any) => Promise<void>;
  onShowAlert: (config: { title: string; message: string; type: "success" | "error" | "info" }) => void;
  onShowConfirm: (config: { title: string; message: string; confirmText: string; type: "error" | "info"; onConfirm: () => void }) => void;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  gallery = [],
  onUpdateShop,
  onShowAlert,
  onShowConfirm,
}) => {

  const handleUpdateGallery = async (urls: string | string[]) => {
    if (!urls) return;
    const urlsArray = Array.isArray(urls) ? urls : [urls];
    if (urlsArray.length === 0) return;

    const currentCount = gallery.length;
    if (currentCount >= 5) {
      onShowAlert({
        title: "Gallery Full",
        message: "Maximum 5 photos/videos allowed in the gallery.",
        type: "info",
      });
      return;
    }

    const availableSlots = 5 - currentCount;
    const urlsToAdd = urlsArray.slice(0, availableSlots);

    if (urlsArray.length > availableSlots) {
      onShowAlert({
        title: "Gallery Limit Reached",
        message: `Only 5 photos/videos allowed. Added ${urlsToAdd.length} item(s).`,
        type: "info",
      });
    }

    const newGallery = [...gallery, ...urlsToAdd];
    await onUpdateShop({ gallery: newGallery });
  };

  const handleDeletePhoto = async (idx: number) => {
    onShowConfirm({
      title: "Delete Photo",
      message: "Are you sure you want to remove this photo from your gallery?",
      confirmText: "Yes, Delete",
      type: "error",
      onConfirm: async () => {
        const newGallery = gallery.filter((_, i) => i !== idx);
        await onUpdateShop({ gallery: newGallery });
      },
    });
  };

  return (
    <div className="bg-white rounded-md border border-zinc-200/80 shadow-sm p-5 dark:bg-zinc-900 dark:border-zinc-800 space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Photo Gallery
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Visual showcase of your business physical presence and products
          </p>
        </div>
        <div className="px-3 py-1 bg-zinc-50 border border-zinc-200/80 rounded-md text-[10px] font-bold text-zinc-500 dark:bg-zinc-850 dark:border-zinc-800 dark:text-zinc-400 shadow-sm">
          {gallery.length} / 5
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
        {gallery.map((url, i) => (
          <div
            key={i}
            className="aspect-square relative group rounded-md overflow-hidden border border-zinc-200/80 shadow-sm bg-white dark:border-zinc-800 dark:bg-zinc-950"
          >
            {isVideoUrl(url) ? (
              <video
                src={url.includes(" ") ? url.replace(/\s/g, "%20") : url}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                controls={false}
                muted
                loop
                autoPlay
                playsInline
              />
            ) : (
              <img
                src={url.includes(" ") ? url.replace(/\s/g, "%20") : url}
                alt={`Gallery ${i}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )}
            <button
              onClick={() => handleDeletePhoto(i)}
              className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 shadow-sm active:scale-95 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {gallery.length < 5 && (
          <div className="aspect-square">
            <ImageUpload
              onUpload={handleUpdateGallery}
              folder="shops"
              compact={true}
              multiple={true}
            />
          </div>
        )}
      </div>

      <div className="bg-blue-500/5 p-4 rounded-md border border-blue-500/10 flex items-center gap-3">
        <ImageIcon size={16} className="text-blue-500 shrink-0" />
        <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
          Tip: Upload high-quality photos or short video clips of your shop front, interior, or products to build customer trust.
        </p>
      </div>
    </div>
  );
};

export default PhotoGallery;
