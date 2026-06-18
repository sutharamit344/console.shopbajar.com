import React, { useState, useRef, useCallback } from "react";
import {
  ShoppingBag,
  Search,
  Download,
  Upload,
  LayoutGrid,
  LayoutList,
  Plus,
  ChevronRight,
  Settings2,
  X,
  Loader2,
  CircleAlert,
  QrCode,
  Copy,
  Check
} from "lucide-react";
import { slugify } from "../../lib/slugify";
import ImageUpload from "../UI/ImageUpload";
import Input from "../UI/Input";
import Select from "../UI/Select";
import Textarea from "../UI/Textarea";
import Button from "../UI/Button";
import Dialog from "../UI/Dialog";
import { getCustomerAppUrl } from "../../lib/config";

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

const countCatalogVideos = (menu: any[]): number => {
  if (!menu) return 0;
  let count = 0;
  for (const cat of menu) {
    if (cat.items) {
      for (const item of cat.items) {
        if (item.image && isVideoUrl(item.image)) {
          count++;
        }
      }
    }
  }
  return count;
};

interface CatalogImageProps {
  src?: string;
  alt: string;
  featured?: boolean;
  isNew?: boolean;
}

const CatalogImage: React.FC<CatalogImageProps> = ({ src, alt, featured, isNew }) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-800 overflow-hidden flex items-center justify-center">
      {src && !hasError ? (
        isVideoUrl(src) ? (
          <video
            src={src.includes(" ") ? src.replace(/\s/g, "%20") : src}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            controls={false}
            muted
            loop
            autoPlay
            playsInline
          />
        ) : (
          <img
            src={src.includes(" ") ? src.replace(/\s/g, "%20") : src}
            alt={alt}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setHasError(true)}
          />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-300 bg-zinc-100 absolute inset-0 dark:bg-zinc-800 dark:text-zinc-700">
          <ShoppingBag size={18} />
        </div>
      )}
      <div className="absolute top-0 left-0 z-10 flex flex-col items-start gap-0">
        {featured && (
          <span className="text-[7px] font-black bg-[#FF6A00] text-white px-1.5 py-0.5 rounded-br uppercase tracking-wide shadow-sm flex items-center">
            Featured
          </span>
        )}
        {isNew !== false && (
          <span className={`text-[7px] font-black bg-emerald-600 text-white px-1.5 py-0.5 ${featured ? 'rounded-r' : 'rounded-br'} uppercase tracking-wide shadow-sm flex items-center`}>
            New
          </span>
        )}
      </div>
    </div>
  );
};

interface CatalogManagerProps {
  shop: any;
  onUpdateMenu: (newMenu: any[]) => Promise<void>;
  onShowAlert: (config: { title: string; message: string; type: "success" | "error" | "info" }) => void;
  onShowConfirm: (config: { title: string; message: string; confirmText: string; type: "error" | "info"; onConfirm: () => void }) => void;
}

const CatalogManager: React.FC<CatalogManagerProps> = ({
  shop,
  onUpdateMenu,
  onShowAlert,
  onShowConfirm,
}) => {
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [activeCategoryIdx, setActiveCategoryIdx] = useState<number | null>(null);
  const [activeItemIdx, setActiveItemIdx] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Item Form State
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemImage, setItemImage] = useState("");
  const [itemFeatured, setItemFeatured] = useState(false);
  const [itemIsNew, setItemIsNew] = useState(true);
  const [itemStock, setItemStock] = useState("");
  const [trackStock, setTrackStock] = useState(false);
  const [itemDiet, setItemDiet] = useState("");
  const [itemIsService, setItemIsService] = useState(false);
  const [itemServiceDuration, setItemServiceDuration] = useState("30");
  const [itemHighlights, setItemHighlights] = useState<string[]>([]);
  const [newHighlight, setNewHighlight] = useState("");
  const [itemHighlightsLabel, setItemHighlightsLabel] = useState("");

  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const searchDebounceRef = useRef<any>(null);
  const [catalogView, setCatalogView] = useState<"grid" | "list">("grid");

  const [showQRModal, setShowQRModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloadingPoster, setDownloadingPoster] = useState(false);

  const handleDownloadPoster = async () => {
    if (!posterRef.current) return;
    setDownloadingPoster(true);
    try {
      const { toPng } = await import("html-to-image");
      await new Promise((r) => setTimeout(r, 600)); // Wait for image render
      const dataUrl = await toPng(posterRef.current, {
        quality: 1,
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `${slugify(shop?.name || "shop")}_menu_poster.png`;
      link.href = dataUrl;
      link.click();
      onShowAlert({
        title: "Poster Downloaded",
        message: "Your designed menu poster has been downloaded successfully.",
        type: "success",
      });
    } catch (err) {
      console.error("Poster Download failed:", err);
      onShowAlert({
        title: "Download Failed",
        message: "Failed to render designed poster. Opening direct QR Code instead.",
        type: "error",
      });
      const directUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
        getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}/catalog`)
      )}&color=0A0A0F&bgcolor=FFFFFF`;
      window.open(directUrl, "_blank");
    } finally {
      setDownloadingPoster(false);
    }
  };

  const handleDownloadMenuQR = () => {
    const directUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
      getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}/catalog`)
    )}&color=0A0A0F&bgcolor=FFFFFF`;
    window.open(directUrl, "_blank");
  };

  const handleCopyMenuLink = () => {
    const url = getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}/catalog`);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onShowAlert({
      title: "Link Copied",
      message: "Direct menu link copied to your clipboard.",
      type: "success",
    });
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleCatalogSearch = useCallback((value: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setSearchQuery(value), 250);
  }, []);

  const handleAddCategory = () => {
    if (!categoryName.trim()) return;
    const newMenu = [...(shop?.menu || []), { name: categoryName.trim(), items: [] }];
    onUpdateMenu(newMenu);
    setCategoryName("");
    setShowCategoryModal(false);
  };

  const handleEditCategory = () => {
    if (!categoryName.trim() || activeCategoryIdx === null) return;
    const newMenu = [...(shop?.menu || [])];
    newMenu[activeCategoryIdx] = { ...newMenu[activeCategoryIdx], name: categoryName.trim() };
    onUpdateMenu(newMenu);
    setCategoryName("");
    setShowEditCategoryModal(false);
  };

  const handleDeleteCategory = () => {
    if (activeCategoryIdx === null) return;
    onShowConfirm({
      title: "Delete Category",
      message: `Are you sure you want to delete the entire category "${shop?.menu?.[activeCategoryIdx]?.name}" and all its items? This action cannot be undone.`,
      confirmText: "Delete Everything",
      type: "error",
      onConfirm: () => {
        const newMenu = (shop?.menu || []).filter((_: any, i: number) => i !== activeCategoryIdx);
        onUpdateMenu(newMenu);
        setShowEditCategoryModal(false);
      },
    });
  };

  const toggleCategory = (idx: number) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleAddItem = () => {
    if (!itemName.trim() || activeCategoryIdx === null) return;
    const newMenu = [...(shop?.menu || [])];
    const updatedCategory = { ...newMenu[activeCategoryIdx] };
    updatedCategory.items = [
      ...(updatedCategory.items || []),
      {
        name: itemName.trim(),
        price: itemPrice ? parseFloat(itemPrice) : "",
        description: itemDescription.trim(),
        image: itemImage,
        featured: itemFeatured,
        isNew: itemIsNew,
        stock: trackStock ? (itemStock ? parseInt(itemStock, 10) : 0) : null,
        diet: itemDiet || null,
        serviceDetails: itemIsService
          ? { isService: true, duration: parseInt(itemServiceDuration, 10) || 30 }
          : null,
        highlights: itemHighlights,
        highlightsLabel: itemHighlightsLabel.trim() || "Highlights",
      },
    ];
    newMenu[activeCategoryIdx] = updatedCategory;
    onUpdateMenu(newMenu);
    resetItemForm();
    setShowItemModal(false);
  };

  const handleEditItem = () => {
    if (!itemName.trim() || activeCategoryIdx === null || activeItemIdx === null) return;
    const newMenu = [...(shop?.menu || [])];
    const updatedCategory = { ...newMenu[activeCategoryIdx] };
    const updatedItems = [...(updatedCategory.items || [])];
    updatedItems[activeItemIdx] = {
      ...updatedItems[activeItemIdx],
      name: itemName.trim(),
      price: itemPrice ? parseFloat(itemPrice) : "",
      description: itemDescription.trim(),
      image: itemImage,
      featured: itemFeatured,
      isNew: itemIsNew,
      stock: trackStock ? (itemStock ? parseInt(itemStock, 10) : 0) : null,
      diet: itemDiet || null,
      serviceDetails: itemIsService
        ? { isService: true, duration: parseInt(itemServiceDuration, 10) || 30 }
        : null,
      highlights: itemHighlights,
      highlightsLabel: itemHighlightsLabel.trim() || "Highlights",
    };
    updatedCategory.items = updatedItems;
    newMenu[activeCategoryIdx] = updatedCategory;
    onUpdateMenu(newMenu);
    resetItemForm();
    setShowEditItemModal(false);
  };

  const resetItemForm = () => {
    setItemName("");
    setItemPrice("");
    setItemDescription("");
    setItemImage("");
    setItemFeatured(false);
    setItemIsNew(true);
    setItemStock("");
    setTrackStock(false);
    setItemDiet("");
    setItemIsService(false);
    setItemServiceDuration("30");
    setItemHighlights([]);
    setNewHighlight("");
    setItemHighlightsLabel("");
  };

  const handleDeleteItem = () => {
    if (activeCategoryIdx === null || activeItemIdx === null) return;
    const newMenu = [...(shop?.menu || [])];
    const updatedCategory = { ...newMenu[activeCategoryIdx] };
    const updatedItems = [...(updatedCategory.items || [])];
    updatedItems.splice(activeItemIdx, 1);
    updatedCategory.items = updatedItems;
    newMenu[activeCategoryIdx] = updatedCategory;
    onUpdateMenu(newMenu);
    setShowDeleteModal(false);
  };

  const handleExportCatalog = async () => {
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const menu = shop?.menu || [];
      const exportData: any[] = [];

      menu.forEach((section: any) => {
        const catName = section.category || section.name || "Catalog";
        if (section.items && Array.isArray(section.items)) {
          section.items.forEach((item: any) => {
            exportData.push({
              "Section Category": catName,
              "Item Name": item.name || "",
              Description: item.description || "",
              Price: item.price || "",
              "Image URL": item.image || "",
              "Is Popular": item.featured || item.popular ? "Yes" : "No",
              "Is New": item.isNew !== false ? "Yes" : "No",
            });
          });
        }
      });

      if (exportData.length === 0) {
        exportData.push({
          "Section Category": "Example Section",
          "Item Name": "Example Item",
          Description: "Premium quality product",
          Price: 500,
          "Image URL": "",
          "Is Popular": "Yes",
          "Is New": "Yes",
        });
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Catalog");
      XLSX.writeFile(wb, `${slugify(shop?.name || "shop")}_catalog.xlsx`);
      onShowAlert({
        title: "Export Successful",
        message: "Catalog exported successfully as an Excel spreadsheet.",
        type: "success",
      });
    } catch (err) {
      console.error("Export error:", err);
      onShowAlert({
        title: "Export Failed",
        message: "Failed to export catalog. Please verify xlsx dependency.",
        type: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const XLSX = await import("xlsx");
      const reader = new FileReader();

      reader.onload = async (event: any) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          if (!jsonData || jsonData.length === 0) {
            onShowAlert({
              title: "Import Failed",
              message: "No items found in the uploaded spreadsheet.",
              type: "error",
            });
            return;
          }

          const sectionsMap: Record<string, any[]> = {};

          jsonData.forEach((row: any) => {
            const catName =
              row["Section Category"]?.toString().trim() ||
              row["Category"]?.toString().trim() ||
              row["section"]?.toString().trim() ||
              "Catalog";
            const nameStr =
              row["Item Name"]?.toString().trim() ||
              row["Name"]?.toString().trim() ||
              row["name"]?.toString().trim() ||
              "";
            const description =
              row["Description"]?.toString().trim() ||
              row["description"]?.toString().trim() ||
              "";
            const price = parseFloat(row["Price"] || row["price"] || 0) || 0;
            const image =
              row["Image URL"]?.toString().trim() ||
              row["image"]?.toString().trim() ||
              "";
            const isPopStr = (
              row["Is Popular"] ||
              row["popular"] ||
              row["featured"] ||
              ""
            )
              .toString()
              .toLowerCase();
            const featured =
              isPopStr === "yes" || isPopStr === "true" || isPopStr === "1";

            const isNewStr = (
              row["Is New"] ||
              row["new"] ||
              row["isNew"] ||
              ""
            )
              .toString()
              .toLowerCase();
            const isNew = isNewStr === "" ? true : (isNewStr === "yes" || isNewStr === "true" || isNewStr === "1");

            if (nameStr) {
              if (!sectionsMap[catName]) sectionsMap[catName] = [];
              sectionsMap[catName].push({
                name: nameStr,
                description,
                price: price || "",
                image,
                featured,
                popular: featured,
                isNew,
              });
            }
          });

          const newMenu = Object.entries(sectionsMap).map(([name, items]) => ({
            name,
            category: name,
            items,
          }));

          await onUpdateMenu(newMenu);
          onShowAlert({
            title: "Import Successful",
            message: `Successfully imported ${jsonData.length} items across ${newMenu.length} sections!`,
            type: "success",
          });
        } catch (error) {
          console.error("Import error:", error);
          onShowAlert({
            title: "Import Failed",
            message:
              "Failed to parse file. Please ensure correct template structure.",
            type: "error",
          });
        } finally {
          if (e.target) e.target.value = "";
          setIsImporting(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("Import error:", err);
      onShowAlert({
        title: "Import Failed",
        message: "Failed to import catalog. Please verify xlsx dependency.",
        type: "error",
      });
      if (e.target) e.target.value = "";
      setIsImporting(false);
    }
  };

  const filteredMenu = (shop?.menu || [])
    .map((cat: any, cIdx: number) => ({
      ...cat,
      originalIdx: cIdx,
      items: (cat.items || [])
        .map((item: any, iIdx: number) => ({ ...item, originalIdx: iIdx }))
        .filter((item: any) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
    }))
    .filter(
      (cat: any) =>
        cat.items.length > 0 ||
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="bg-white rounded-md border border-zinc-200/80 overflow-hidden shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
      <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
            Catalog Management
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Manage your categories, items, and inventory
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              placeholder="Search items..."
              defaultValue={searchQuery}
              onChange={(e) => handleCatalogSearch(e.target.value)}
              className="pl-7 pr-2.5 h-8 bg-zinc-50 border border-zinc-200/80 rounded-md text-xs focus:bg-white focus:border-[#FF6A00]/40 outline-none transition-all w-32 sm:w-44 font-medium dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 shadow-sm"
            />
          </div>
          <button
            onClick={handleExportCatalog}
            disabled={isExporting}
            className="h-8 px-2.5 bg-zinc-50 border border-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-md flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-750 active:scale-95 transition-all shadow-sm whitespace-nowrap disabled:opacity-50 cursor-pointer"
            title="Download Catalog as Excel Spreadsheet"
          >
            {isExporting ? (
              <>
                <Loader2 size={12} className="animate-spin text-[#FF6A00]" />{" "}
                Exporting...
              </>
            ) : (
              <>
                <Download size={12} /> Export
              </>
            )}
          </button>
          <label
            className="cursor-pointer h-8 px-2.5 bg-zinc-50 border border-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-md flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-750 active:scale-95 transition-all shadow-sm whitespace-nowrap mb-0"
            title="Upload Excel or CSV Catalog"
          >
            {isImporting ? (
              <>
                <Loader2 size={12} className="animate-spin text-[#FF6A00]" />{" "}
                Importing...
              </>
            ) : (
              <>
                <Upload size={12} /> Import
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportCatalog}
                  disabled={isImporting}
                  className="hidden"
                />
              </>
            )}
          </label>
          {/* View Toggle */}
          <div className="flex items-center h-8 rounded-md border border-zinc-200/80 dark:border-zinc-700 overflow-hidden bg-zinc-50 dark:bg-zinc-800">
            <button
              onClick={() => setCatalogView("grid")}
              title="Grid View"
              className={`h-full w-8 flex items-center justify-center transition-all cursor-pointer ${catalogView === "grid"
                ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setCatalogView("list")}
              title="List View"
              className={`h-full w-8 flex items-center justify-center transition-all cursor-pointer ${catalogView === "list"
                ? "bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
            >
              <LayoutList size={13} />
            </button>
          </div>

          <button
            onClick={() => setShowQRModal(true)}
            className="h-8 px-2.5 bg-zinc-50 border border-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-md flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95 transition-all shadow-sm whitespace-nowrap cursor-pointer"
            title="Scan or download direct menu QR Code"
          >
            <QrCode size={12} className="text-[#FF6A00]" /> Menu QR
          </button>

          <button
            onClick={() => setShowCategoryModal(true)}
            className="h-8 px-3 bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 text-xs font-bold rounded-md flex items-center gap-1 hover:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-95 transition-all whitespace-nowrap shadow-sm cursor-pointer"
          >
            <Plus size={12} /> Add Category
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filteredMenu.length > 0 ? (
          filteredMenu.map((category: any) => {
            const idx = category.originalIdx;
            const isCollapsed = collapsedCategories.has(idx) && searchQuery === "";
            return (
              <div
                key={idx}
                className="border border-zinc-200/80 rounded-md overflow-hidden dark:border-zinc-800 shadow-sm"
              >
                <div className="p-3 bg-zinc-50 dark:bg-zinc-850/50 flex justify-between items-center border-b border-zinc-200/80 dark:border-zinc-850">
                  <div
                    className="flex items-center gap-2 cursor-pointer group"
                    onClick={() => toggleCategory(idx)}
                  >
                    <div
                      className={`transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""
                        }`}
                    >
                      <ChevronRight size={14} className="text-zinc-400" />
                    </div>
                    <ShoppingBag size={14} className="text-[#FF6A00]" />
                    <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                      {category.name}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200/80 dark:border-zinc-700 shadow-sm">
                      {category.items?.length || 0} items
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setActiveCategoryIdx(idx);
                        setCategoryName(category.name);
                        setShowEditCategoryModal(true);
                      }}
                      className="h-7 w-7 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 rounded-md flex items-center justify-center transition-all text-zinc-500 dark:text-zinc-400 cursor-pointer"
                    >
                      <Settings2 size={12} />
                    </button>
                    <button
                      onClick={() => {
                        setActiveCategoryIdx(idx);
                        resetItemForm();
                        setItemFeatured(false);
                        setShowItemModal(true);
                      }}
                      className="h-7 px-3 bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 text-[10px] font-bold rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-95 transition-all shadow-sm cursor-pointer"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  catalogView === "grid" ? (
                    /* Grid View */
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 animate-in slide-in-from-top-2 duration-200">
                      {category.items?.map((item: any) => {
                        const iIdx = item.originalIdx;
                        return (
                          <div
                            key={iIdx}
                            onClick={() => {
                              setActiveCategoryIdx(idx);
                              setActiveItemIdx(iIdx);
                              setItemName(item.name);
                              setItemPrice(item.price ? item.price.toString() : "");
                              setItemDescription(item.description || "");
                              setItemImage(item.image || "");
                              setItemFeatured(!!item.featured);
                              setItemIsNew(item.isNew !== false);
                              setItemDiet(item.diet || "");
                              const hasStock = item.stock !== undefined && item.stock !== null && item.stock !== "";
                              setTrackStock(hasStock);
                              setItemStock(hasStock ? item.stock.toString() : "");
                              setItemIsService(!!item.serviceDetails?.isService);
                              setItemServiceDuration(item.serviceDetails?.duration?.toString() || "30");
                              setItemHighlights(item.highlights || []);
                              setNewHighlight("");
                              setItemHighlightsLabel(item.highlightsLabel || "Highlights");
                              setShowEditItemModal(true);
                            }}
                            className="group bg-white border border-zinc-200/80 hover:border-[#FF6A00]/40 hover:shadow-sm transition-all duration-200 rounded-md overflow-hidden flex flex-col dark:bg-zinc-950 dark:border-zinc-850 dark:hover:border-[#FF6A00]/40 cursor-pointer"
                          >
                            <div className="relative w-full aspect-square bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
                              <CatalogImage
                                src={item.image}
                                alt={item.name}
                                featured={item.featured}
                                isNew={item.isNew}
                              />
                            </div>
                            <div className="flex-1 flex flex-col p-2.5 gap-1.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {item.diet === "veg" && (
                                    <div className="w-3 h-3 border border-emerald-600 flex items-center justify-center bg-white rounded-[2px] shrink-0" title="Vegetarian">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                    </div>
                                  )}
                                  {item.diet === "nonveg" && (
                                    <div className="w-3 h-3 border border-rose-600 flex items-center justify-center bg-white rounded-[2px] shrink-0" title="Non-Vegetarian">
                                      <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                    </div>
                                  )}
                                  <h4 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate tracking-tight leading-tight">
                                    {item.name}
                                  </h4>
                                </div>
                                <p className="text-[9.5px] text-zinc-400 dark:text-zinc-500 font-medium line-clamp-1 leading-snug mt-0.5">
                                  {item.description || "—"}
                                </p>
                              </div>
                              <div className="flex items-center justify-between gap-1 flex-wrap pt-1 border-t border-zinc-50 dark:border-zinc-900">
                                <span className="text-[11.5px] font-black text-[#FF6A00] leading-none">
                                  {item.price !== "" && item.price != null ? `₹${item.price}` : "On Request"}
                                </span>
                                {item.stock !== undefined && item.stock !== null && item.stock !== "" && (
                                  <span className={`text-[8.5px] font-bold px-1 py-0.5 rounded ${parseInt(item.stock, 10) <= 0 ? 'bg-red-50 text-red-650 dark:bg-red-950/20 dark:text-red-400' : parseInt(item.stock, 10) <= 5 ? 'bg-amber-50 text-amber-650 dark:bg-amber-950/20 dark:text-amber-400 animate-pulse' : 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                                    {parseInt(item.stock, 10) <= 0 ? 'Out of stock' : `${item.stock} left`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* List View */
                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 animate-in slide-in-from-top-2 duration-200">
                      {category.items?.map((item: any) => {
                        const iIdx = item.originalIdx;
                        return (
                          <div
                            key={iIdx}
                            onClick={() => {
                              setActiveCategoryIdx(idx);
                              setActiveItemIdx(iIdx);
                              setItemName(item.name);
                              setItemPrice(item.price ? item.price.toString() : "");
                              setItemDescription(item.description || "");
                              setItemImage(item.image || "");
                              setItemFeatured(!!item.featured);
                              setItemIsNew(item.isNew !== false);
                              setItemDiet(item.diet || "");
                              const hasStock = item.stock !== undefined && item.stock !== null && item.stock !== "";
                              setTrackStock(hasStock);
                              setItemStock(hasStock ? item.stock.toString() : "");
                              setItemIsService(!!item.serviceDetails?.isService);
                              setItemServiceDuration(item.serviceDetails?.duration?.toString() || "30");
                              setItemHighlights(item.highlights || []);
                              setNewHighlight("");
                              setItemHighlightsLabel(item.highlightsLabel || "Highlights");
                              setShowEditItemModal(true);
                            }}
                            className="group flex items-center gap-3 p-2 bg-white border border-zinc-200/80 hover:border-[#FF6A00]/40 hover:shadow-sm dark:bg-zinc-950 dark:border-zinc-850 dark:hover:border-[#FF6A00]/40 rounded-md transition-all cursor-pointer"
                          >
                            <div className="relative self-stretch w-14 shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900 rounded-md">
                              <CatalogImage
                                src={item.image}
                                alt={item.name}
                                featured={item.featured}
                                isNew={item.isNew}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {item.diet === "veg" && (
                                  <div className="w-3 h-3 border border-emerald-600 flex items-center justify-center bg-white rounded-[2px] shrink-0" title="Vegetarian">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                  </div>
                                )}
                                {item.diet === "nonveg" && (
                                  <div className="w-3 h-3 border border-rose-600 flex items-center justify-center bg-white rounded-[2px] shrink-0" title="Non-Vegetarian">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                  </div>
                                )}
                                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate tracking-tight leading-tight">
                                  {item.name}
                                </h4>
                              </div>
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium truncate leading-snug mb-1">
                                {item.description || "—"}
                              </p>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black text-[#FF6A00] leading-none">
                                  {item.price !== "" && item.price != null ? `₹${item.price}` : "On Request"}
                                </span>
                                {item.stock !== undefined && item.stock !== null && item.stock !== "" && (
                                  <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded ${parseInt(item.stock, 10) <= 0 ? 'bg-red-55 text-red-650 dark:bg-red-950/20' : 'bg-zinc-50 text-zinc-500 dark:bg-zinc-800'}`}>
                                    {parseInt(item.stock, 10) <= 0 ? 'Out of stock' : `${item.stock} in stock`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-md flex items-center justify-center mx-auto mb-3 border border-zinc-200/80 dark:border-zinc-700">
              <ShoppingBag size={28} className="text-zinc-400" />
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1 tracking-tight">
              {searchQuery ? "No results found" : "No Items Yet"}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mb-4 max-w-xs mx-auto">
              {searchQuery
                ? "Try searching for something else"
                : "Start adding products or services to your catalog"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => {
                  resetItemForm();
                  setShowCategoryModal(true);
                }}
                className="h-9 px-5 bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 text-xs font-bold rounded-md shadow-sm active:scale-95 transition-all cursor-pointer hover:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                Add First Category
              </button>
            )}
          </div>
        )}
      </div>

      {/* Menu QR Code Modal */}
      <Dialog
        isOpen={showQRModal}
        onClose={() => !downloadingPoster && setShowQRModal(false)}
        title="Menu QR Code"
        subtitle="Customers can scan this code to view your digital menu catalog instantly"
        maxWidth="max-w-[380px]"
      >
        <div className="space-y-5 py-2 flex flex-col items-center text-center">
          <div className="p-4 bg-white dark:bg-white rounded-xl border border-zinc-200 shadow-md relative">
            <div className="w-44 h-44 flex items-center justify-center bg-white">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}/catalog`)
                )}&color=0A0A0F&bgcolor=FFFFFF`}
                alt="Menu QR"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#FF6A00] text-white text-[9px] font-black uppercase tracking-widest rounded shadow-md border border-[#FF6A00]/20">
              Scan Menu
            </div>
          </div>

          <div className="w-full space-y-3">
            <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 text-left">
              <span className="text-[9px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">
                Direct Menu Link
              </span>
              <span className="text-xs font-semibold text-zinc-650 dark:text-zinc-400 truncate block leading-none font-mono">
                {getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}/catalog`)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                size="lg"
                loading={downloadingPoster}
                className="w-full text-xs font-bold gap-1.5 h-10 bg-[#FF6A00] hover:bg-[#e65f00] border-none text-white cursor-pointer"
                onClick={handleDownloadPoster}
              >
                <Download size={13} />
                <span>Download Shop Poster</span>
              </Button>
              
              <div className="flex gap-2">
                <Button
                  variant="dark"
                  size="sm"
                  className="flex-1 text-xs font-bold gap-1.5 h-9"
                  onClick={handleDownloadMenuQR}
                >
                  <QrCode size={13} />
                  <span>QR Code Only</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs font-bold gap-1.5 h-9 border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-800 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  onClick={handleCopyMenuLink}
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copied ? "Copied" : "Copy Link"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden A4 Designed Poster for html-to-image rendering */}
        <div className="absolute top-0 -left-[9999px] pointer-events-none">
          <div
            ref={posterRef}
            className="w-[500px] h-[700px] bg-white text-zinc-900 flex flex-col justify-between p-10 font-sans relative border-8 border-zinc-100"
            style={{
              backgroundImage: "radial-gradient(circle at 50% 50%, #ffffff 0%, #fafafa 100%)",
            }}
          >
            {/* Subtle Orange Accent Bars */}
            <div className="absolute top-0 inset-x-0 h-3 bg-[#FF6A00]" />
            
            {/* Top Shop Info */}
            <div className="flex flex-col items-center text-center mt-6 space-y-4">
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden bg-zinc-50 flex items-center justify-center">
                {shop.logo ? (
                  <img
                    src={`https://images.weserv.nl/?url=${encodeURIComponent(shop.logo)}&output=png&w=150&h=150&fit=cover`}
                    alt=""
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                ) : (
                  <div className="w-full h-full bg-[#FF6A00] flex items-center justify-center text-white text-3xl font-black">
                    {shop.name?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 uppercase">
                  {shop.name}
                </h1>
                <p className="text-[11px] font-bold text-[#FF6A00] tracking-[0.2em] uppercase">
                  Digital Catalog & Menu
                </p>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="flex flex-col items-center justify-center flex-1 my-6 space-y-5">
              <div className="p-6 bg-white rounded-2xl shadow-xl border border-zinc-200/60 relative flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                    getCustomerAppUrl(`/shop/${slugify(shop?.slug || shop?.name || "")}/catalog`)
                  )}&color=0A0A0F&bgcolor=FFFFFF`}
                  alt="Menu QR"
                  className="w-48 h-48 object-contain"
                  crossOrigin="anonymous"
                />
              </div>
              <div className="text-center space-y-1.5 max-w-sm">
                <h2 className="text-lg font-black text-zinc-800 tracking-tight">
                  Scan to Browse & Order
                </h2>
                <p className="text-xs text-zinc-500 font-medium leading-relaxed">
                  Scan the QR Code with your smartphone camera to view our complete list of products, check real-time stock, and place inquiries instantly.
                </p>
              </div>
            </div>

            {/* Bottom Footer Info */}
            <div className="flex flex-col items-center text-center border-t border-zinc-150 pt-6 mt-auto">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-2">
                Powered by
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 bg-[#FF6A00] rounded flex items-center justify-center text-white text-[10px] font-black">
                  SB
                </div>
                <span className="text-xs font-black text-zinc-800 tracking-tight">
                  ShopBajar Console
                </span>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Add Category Modal */}
      <Dialog
        isOpen={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        title="New Category"
        subtitle="Create a section for your items (e.g. Services, Food, Products)"
        icon={Plus}
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Haircuts, Breakfast, Footwear"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end pt-2">
            <Button onClick={handleAddCategory} disabled={!categoryName.trim()}>
              Create Category
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Category Modal */}
      <Dialog
        isOpen={showEditCategoryModal}
        onClose={() => setShowEditCategoryModal(false)}
        title="Edit Category"
        subtitle="Rename or remove this category section"
        icon={Settings2}
      >
        <div className="space-y-4">
          <Input
            label="Category Name"
            placeholder="e.g. Services, Food"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            autoFocus
          />
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={handleDeleteCategory}
              className="text-xs font-bold text-red-500 hover:text-red-650 transition-colors cursor-pointer"
            >
              Delete Category
            </button>
            <Button onClick={handleEditCategory} disabled={!categoryName.trim()}>
              Save Changes
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add Item Modal */}
      <Dialog
        isOpen={showItemModal}
        onClose={() => setShowItemModal(false)}
        title="Add Item"
        subtitle={`Adding to ${activeCategoryIdx !== null ? shop?.menu?.[activeCategoryIdx]?.name : ""}`}
        icon={Plus}
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-shrink-0">
              <ImageUpload
                onUpload={(url) => setItemImage(Array.isArray(url) ? url[0] : url)}
                currentImage={itemImage}
                compact
                label="Photo"
                folder="menu"
                beforeUpload={async (file) => {
                  if (file.type.startsWith("video/")) {
                    const videoCount = countCatalogVideos(shop?.menu);
                    if (videoCount >= 5) {
                      onShowAlert({
                        title: "Video Limit Reached",
                        message: "Maximum 5 videos allowed per shop catalog.",
                        type: "error"
                      });
                      return false;
                    }
                  }
                  return true;
                }}
              />
            </div>
            <div className="flex-1 w-full space-y-2">
              <Input
                label="Item Name"
                placeholder="e.g. Premium Haircut"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
              <div className={`grid ${trackStock ? 'grid-cols-2' : 'grid-cols-1'} gap-2 transition-all duration-200`}>
                <Input
                  label="Price ₹ (Optional)"
                  type="number"
                  placeholder="Leave blank"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                />
                {trackStock && (
                  <Input
                    label="Stock Count"
                    type="number"
                    placeholder="Quantity"
                    value={itemStock}
                    onChange={(e) => setItemStock(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
          <Textarea
            label="Short Description"
            placeholder="Details about catalog items..."
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            rows={2}
          />
          {/* Highlights List Builder */}
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                Highlights Section Title
              </label>
              <input
                type="text"
                placeholder="e.g. Highlights, Specifications, Ingredients"
                value={itemHighlightsLabel}
                onChange={(e) => setItemHighlightsLabel(e.target.value)}
                className="w-full h-8 px-2.5 bg-zinc-50 border border-zinc-200/80 rounded-md text-xs focus:bg-white focus:border-[#FF6A00]/40 outline-none transition-all dark:bg-zinc-850 dark:border-zinc-700 dark:text-zinc-100 mb-1.5"
              />
            </div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
              Add Highlight Point
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 100% Organic, 1 Year Warranty..."
                value={newHighlight}
                onChange={(e) => setNewHighlight(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (newHighlight.trim()) {
                      setItemHighlights([...itemHighlights, newHighlight.trim()]);
                      setNewHighlight("");
                    }
                  }
                }}
                className="flex-1 h-8 px-2.5 bg-zinc-50 border border-zinc-200/80 rounded-md text-xs focus:bg-white focus:border-[#FF6A00]/40 outline-none transition-all dark:bg-zinc-850 dark:border-zinc-700 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => {
                  if (newHighlight.trim()) {
                    setItemHighlights([...itemHighlights, newHighlight.trim()]);
                    setNewHighlight("");
                  }
                }}
                className="h-8 px-3 bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 text-xs font-bold rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer shadow-sm flex items-center justify-center whitespace-nowrap"
              >
                Add
              </button>
            </div>
            {itemHighlights.length > 0 && (
              <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto pr-1">
                {itemHighlights.map((hl, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-1.5 px-2.5 bg-zinc-50 border border-zinc-200/60 rounded-md dark:bg-zinc-800/40 dark:border-zinc-750 shadow-2xs"
                  >
                    <span className="text-[11px] font-medium text-zinc-750 dark:text-zinc-300 break-all">
                      • {hl}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItemHighlights(itemHighlights.filter((_, i) => i !== idx))}
                      className="text-zinc-400 hover:text-red-500 transition-colors p-0.5 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Select
            label="Dietary Preference (Veg / Non-Veg)"
            value={itemDiet}
            onChange={(e) => setItemDiet(e.target.value)}
            options={[
              { value: "", label: "Not Selected (None)" },
              { value: "veg", label: "Vegetarian (Veg)" },
              { value: "nonveg", label: "Non-Vegetarian (Non-Veg)" },
            ]}
          />
          <div className="pt-1 grid grid-cols-3 gap-2">
            <label className="flex items-center gap-2 p-2 bg-zinc-50 border border-zinc-200/80 rounded-md cursor-pointer hover:bg-zinc-100 transition-all dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 shadow-sm">
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(e) => {
                  setTrackStock(e.target.checked);
                  if (!e.target.checked) setItemStock("");
                }}
                className="w-4 h-4 rounded border-zinc-300 text-[#FF6A00] focus:ring-[#FF6A00] dark:border-zinc-650 dark:bg-zinc-850"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 block tracking-tight truncate">
                  Track Stock
                </span>
                <span className="text-[8px] text-zinc-500 dark:text-zinc-400 block font-medium truncate">
                  Inventory
                </span>
              </div>
            </label>
            <label className="flex items-center gap-2 p-2 bg-zinc-50 border border-zinc-200/80 rounded-md cursor-pointer hover:bg-zinc-100 transition-all dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 shadow-sm">
              <input
                type="checkbox"
                checked={itemFeatured}
                onChange={(e) => setItemFeatured(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-[#FF6A00] focus:ring-[#FF6A00] dark:border-zinc-650 dark:bg-zinc-850"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 block tracking-tight truncate">
                  Featured
                </span>
                <span className="text-[8px] text-zinc-500 dark:text-zinc-400 block font-medium truncate">
                  Highlight item
                </span>
              </div>
            </label>
            <label className="flex items-center gap-2 p-2 bg-zinc-50 border border-zinc-200/80 rounded-md cursor-pointer hover:bg-zinc-100 transition-all dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 shadow-sm">
              <input
                type="checkbox"
                checked={itemIsNew}
                onChange={(e) => setItemIsNew(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-[#FF6A00] focus:ring-[#FF6A00] dark:border-zinc-650 dark:bg-zinc-850"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 block tracking-tight truncate">
                  New Tag
                </span>
                <span className="text-[8px] text-zinc-500 dark:text-zinc-400 block font-medium truncate">
                  "New" tag
                </span>
              </div>
            </label>
          </div>

          {/* Appointment Service Toggle */}
          <div className="border border-[#FF6A00]/20 bg-[#FF6A00]/5 rounded-md p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={itemIsService}
                onChange={(e) => setItemIsService(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-[#FF6A00] focus:ring-[#FF6A00]"
              />
              <div>
                <span className="text-[10px] font-bold text-[#FF6A00] block tracking-tight">Bookable Appointment Service</span>
                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-medium">Enable slot booking for this item in Appointment System</span>
              </div>
            </label>
            {itemIsService && (
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">Duration (mins):</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={itemServiceDuration}
                  onChange={(e) => setItemServiceDuration(e.target.value)}
                  className="w-20 h-7 px-2 border border-zinc-200 rounded text-xs font-bold outline-none focus:border-[#FF6A00]/40 bg-white dark:bg-zinc-900 dark:border-zinc-700"
                />
                <span className="text-[10px] text-zinc-400 font-medium">minutes per session</span>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleAddItem} disabled={!itemName.trim()}>
              Add to Catalog
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Edit Item Modal */}
      <Dialog
        isOpen={showEditItemModal}
        onClose={() => setShowEditItemModal(false)}
        title="Edit Item"
        subtitle="Update details for this catalog entry"
        icon={Settings2}
      >
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div className="flex-shrink-0">
              <ImageUpload
                onUpload={(url) => setItemImage(Array.isArray(url) ? url[0] : url)}
                currentImage={itemImage}
                compact
                label="Photo"
                folder="menu"
                beforeUpload={async (file) => {
                  if (file.type.startsWith("video/")) {
                    const originalImage = activeCategoryIdx !== null && activeItemIdx !== null
                      ? shop?.menu?.[activeCategoryIdx]?.items?.[activeItemIdx]?.image
                      : null;
                    const originalIsVideo = originalImage && isVideoUrl(originalImage);
                    const videoCount = countCatalogVideos(shop?.menu);
                    if (videoCount >= 5 && !originalIsVideo) {
                      onShowAlert({
                        title: "Video Limit Reached",
                        message: "Maximum 5 videos allowed per shop catalog.",
                        type: "error"
                      });
                      return false;
                    }
                  }
                  return true;
                }}
              />
            </div>
            <div className="flex-1 w-full space-y-2">
              <Input
                label="Item Name"
                placeholder="e.g. Premium Haircut"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
              <div className={`grid ${trackStock ? 'grid-cols-2' : 'grid-cols-1'} gap-2 transition-all duration-200`}>
                <Input
                  label="Price ₹ (Optional)"
                  type="number"
                  placeholder="Leave blank"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                />
                {trackStock && (
                  <Input
                    label="Stock Count"
                    type="number"
                    placeholder="Quantity"
                    value={itemStock}
                    onChange={(e) => setItemStock(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
          <Textarea
            label="Short Description"
            placeholder="Details about catalog items..."
            value={itemDescription}
            onChange={(e) => setItemDescription(e.target.value)}
            rows={2}
          />
          {/* Highlights List Builder */}
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
                Highlights Section Title
              </label>
              <input
                type="text"
                placeholder="e.g. Highlights, Specifications, Ingredients"
                value={itemHighlightsLabel}
                onChange={(e) => setItemHighlightsLabel(e.target.value)}
                className="w-full h-8 px-2.5 bg-zinc-50 border border-zinc-200/80 rounded-md text-xs focus:bg-white focus:border-[#FF6A00]/40 outline-none transition-all dark:bg-zinc-850 dark:border-zinc-700 dark:text-zinc-100 mb-1.5"
              />
            </div>
            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">
              Add Highlight Point
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. 100% Organic, 1 Year Warranty..."
                value={newHighlight}
                onChange={(e) => setNewHighlight(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (newHighlight.trim()) {
                      setItemHighlights([...itemHighlights, newHighlight.trim()]);
                      setNewHighlight("");
                    }
                  }
                }}
                className="flex-1 h-8 px-2.5 bg-zinc-50 border border-zinc-200/80 rounded-md text-xs focus:bg-white focus:border-[#FF6A00]/40 outline-none transition-all dark:bg-zinc-850 dark:border-zinc-700 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => {
                  if (newHighlight.trim()) {
                    setItemHighlights([...itemHighlights, newHighlight.trim()]);
                    setNewHighlight("");
                  }
                }}
                className="h-8 px-3 bg-zinc-900 text-white dark:bg-zinc-800 dark:text-zinc-100 text-xs font-bold rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-700 active:scale-95 transition-all cursor-pointer shadow-sm flex items-center justify-center whitespace-nowrap"
              >
                Add
              </button>
            </div>
            {itemHighlights.length > 0 && (
              <div className="space-y-1.5 pt-1 max-h-36 overflow-y-auto pr-1">
                {itemHighlights.map((hl, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-1.5 px-2.5 bg-zinc-50 border border-zinc-200/60 rounded-md dark:bg-zinc-800/40 dark:border-zinc-750 shadow-2xs"
                  >
                    <span className="text-[11px] font-medium text-zinc-750 dark:text-zinc-300 break-all">
                      • {hl}
                    </span>
                    <button
                      type="button"
                      onClick={() => setItemHighlights(itemHighlights.filter((_, i) => i !== idx))}
                      className="text-zinc-400 hover:text-red-500 transition-colors p-0.5 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Select
            label="Dietary Preference (Veg / Non-Veg)"
            value={itemDiet}
            onChange={(e) => setItemDiet(e.target.value)}
            options={[
              { value: "", label: "Not Selected (None)" },
              { value: "veg", label: "Vegetarian (Veg)" },
              { value: "nonveg", label: "Non-Vegetarian (Non-Veg)" },
            ]}
          />
          <div className="pt-1 grid grid-cols-3 gap-2">
            <label className="flex items-center gap-2 p-2 bg-zinc-50 border border-zinc-200/80 rounded-md cursor-pointer hover:bg-zinc-100 transition-all dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 shadow-sm">
              <input
                type="checkbox"
                checked={trackStock}
                onChange={(e) => {
                  setTrackStock(e.target.checked);
                  if (!e.target.checked) setItemStock("");
                }}
                className="w-4 h-4 rounded border-zinc-300 text-[#FF6A00] focus:ring-[#FF6A00] dark:border-zinc-650 dark:bg-zinc-850"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 block tracking-tight truncate">
                  Track Stock
                </span>
                <span className="text-[8px] text-zinc-500 dark:text-zinc-400 block font-medium truncate">
                  Inventory
                </span>
              </div>
            </label>
            <label className="flex items-center gap-2 p-2 bg-zinc-50 border border-zinc-200/80 rounded-md cursor-pointer hover:bg-zinc-100 transition-all dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 shadow-sm">
              <input
                type="checkbox"
                checked={itemFeatured}
                onChange={(e) => setItemFeatured(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-[#FF6A00] focus:ring-[#FF6A00] dark:border-zinc-650 dark:bg-zinc-850"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 block tracking-tight truncate">
                  Featured
                </span>
                <span className="text-[8px] text-zinc-500 dark:text-zinc-400 block font-medium truncate">
                  Highlight item
                </span>
              </div>
            </label>
            <label className="flex items-center gap-2 p-2 bg-zinc-50 border border-zinc-200/80 rounded-md cursor-pointer hover:bg-zinc-100 transition-all dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 shadow-sm">
              <input
                type="checkbox"
                checked={itemIsNew}
                onChange={(e) => setItemIsNew(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-[#FF6A00] focus:ring-[#FF6A00] dark:border-zinc-650 dark:bg-zinc-850"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 block tracking-tight truncate">
                  New Tag
                </span>
                <span className="text-[8px] text-zinc-500 dark:text-zinc-400 block font-medium truncate">
                  "New" tag
                </span>
              </div>
            </label>
          </div>

          {/* Appointment Service Toggle */}
          <div className="border border-[#FF6A00]/20 bg-[#FF6A00]/5 rounded-md p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={itemIsService}
                onChange={(e) => setItemIsService(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-[#FF6A00] focus:ring-[#FF6A00]"
              />
              <div>
                <span className="text-[10px] font-bold text-[#FF6A00] block tracking-tight">Bookable Appointment Service</span>
                <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-medium">Enable slot booking for this item in Appointment System</span>
              </div>
            </label>
            {itemIsService && (
              <div className="flex items-center gap-2 pt-1">
                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">Duration (mins):</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={itemServiceDuration}
                  onChange={(e) => setItemServiceDuration(e.target.value)}
                  className="w-20 h-7 px-2 border border-zinc-200 rounded text-xs font-bold outline-none focus:border-[#FF6A00]/40 bg-white dark:bg-zinc-900 dark:border-zinc-700"
                />
                <span className="text-[10px] text-zinc-400 font-medium">minutes per session</span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => {
                setShowEditItemModal(false);
                setShowDeleteModal(true);
              }}
              className="text-xs font-bold text-red-500 hover:text-red-650 transition-colors cursor-pointer"
            >
              Delete Item
            </button>
            <Button onClick={handleEditItem} disabled={!itemName.trim()}>
              Update Item
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Remove Item"
        subtitle="Are you sure you want to delete this item from your catalog?"
        icon={CircleAlert}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-zinc-50 rounded-md border border-zinc-200/80 dark:bg-zinc-800/50 dark:border-zinc-700 shadow-sm">
            <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-0.5">
              {activeCategoryIdx !== null && activeItemIdx !== null ? shop?.menu?.[activeCategoryIdx]?.items?.[activeItemIdx]?.name : ""}
            </p>
            <p className="text-[11px] font-bold text-[#FF6A00]">
              ₹{activeCategoryIdx !== null && activeItemIdx !== null ? shop?.menu?.[activeCategoryIdx]?.items?.[activeItemIdx]?.price : ""}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-9"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1 h-9 bg-red-500 hover:bg-red-650 border-red-500 text-white font-bold"
              onClick={handleDeleteItem}
            >
              Delete
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default CatalogManager;
