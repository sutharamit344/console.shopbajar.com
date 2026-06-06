import React, { useState, useEffect } from "react";
import { slugify } from "../../lib/slugify";
import { uploadImage } from "../../lib/storage";
import { proposeCategory, proposeCluster } from "../../lib/db";
import ImageUpload from "../UI/ImageUpload";
import Input from "../UI/Input";
import Select from "../UI/Select";
import HybridSelect from "../UI/HybridSelect";
import Textarea from "../UI/Textarea";
import Button from "../UI/Button";
import MapComponent from "../UI/MapComponent";

// Redux Toolkit Integration
import { useSelector, useDispatch } from "react-redux";
import { AppDispatch } from "../../redux/store";
import { fetchMasterDirectory } from "../../redux/thunks/masterDataThunks";
import {
  selectMasterCategories,
  selectMasterClusters,
  selectMasterCountries,
  selectMasterStates,
  selectMasterCities,
  selectMasterAreas,
} from "../../redux/selectors/masterDataSelectors";

// Icons
import {
  Save,
  CircleCheckBig,
  CircleAlert,
  Plus,
  Loader2,
  Navigation,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Sparkles,
  Eye,
  LinkIcon,
  MapIcon,
  Search,
  Building2,
  Mail,
  Globe,
} from "lucide-react";

interface ShopFormProps {
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}

const ShopForm: React.FC<ShopFormProps> = ({
  onSubmit,
  isLoading = false,
  error: externalError,
}) => {
  const dispatch = useDispatch<AppDispatch>();

  // Master Data from Redux
  const masterCategories = useSelector(selectMasterCategories) || [];
  const masterClusters = useSelector(selectMasterClusters) || [];
  const masterCountries = useSelector(selectMasterCountries) || [];
  const masterStates = useSelector(selectMasterStates) || [];
  const masterCities = useSelector(selectMasterCities) || [];
  const masterAreas = useSelector(selectMasterAreas) || [];

  const [currentStep, setCurrentStep] = useState(1);
  const [localError, setLocalError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const totalSteps = 2;

  const [formData, setFormData] = useState<any>({
    name: "",
    category: "",
    city: "",
    state: "",
    country: "India",
    area: "",
    zone: "",
    phone: "",
    ownerEmail: "",
    description: "",
    mapEmbed: "",
    primaryColor: "#FF6A00",
    secondaryColor: "#0A0A0F",
    rating: "5.0",
    logo: "",
    businessType: "mixed",
    shopNo: "",
    building: "",
    village: "",
    socialLinks: [],
    coverImage: "",
    clusterType: "",
    pincode: "",
    lat: null,
    lng: null,
  });

  const STORAGE_KEY = "shop_form_draft";

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [proposedCategory, setProposedCategory] = useState("");
  const [showCustomCluster, setShowCustomCluster] = useState(false);
  const [proposedCluster, setProposedCluster] = useState("");
  const [draftLoadedAtMount, setDraftLoadedAtMount] = useState(false);
  const [showMoreAddress, setShowMoreAddress] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState("");

  const steps = [
    { title: "Basics", desc: "Identity" },
    { title: "Location", desc: "Contact" },
  ];

  // Fetch Master Directory on Mount
  useEffect(() => {
    dispatch(fetchMasterDirectory());
  }, [dispatch]);

  // Load draft on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setFormData((prev: any) => ({ ...prev, ...draft }));
        setDraftLoadedAtMount(true);
        if (draft.category === "OTHER_PROPOSE") setShowNewCategoryInput(true);
        if (draft.clusterType === "CUSTOM") setShowCustomCluster(true);
        if (draft.logo) setLogoPreview(draft.logo);
        if (draft.coverImage) setCoverPreview(draft.coverImage);
      } catch (e) {
        console.error("Failed to parse draft", e);
      }
    }
  }, []);

  // Save draft on state change
  const updateDraft = (newData: any) => {
    setFormData((prev: any) => {
      const updated = { ...prev, ...newData };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Hierarchical Options
  const dbCategories = masterCategories.map((c) => c.name);
  const countryOptions = masterCountries.map((c) => ({ value: c.name, label: c.name }));

  const selectedCountryId = masterCountries.find((c) => c.name === formData.country)?.id;
  const filteredStates = masterStates.filter(
    (s) => !selectedCountryId || s.countryId === selectedCountryId
  );
  const stateOptions = filteredStates.map((s) => ({ value: s.name, label: s.name }));

  const selectedStateId = masterStates.find((s) => s.name === formData.state)?.id;
  const filteredCities = masterCities.filter(
    (c) => !selectedStateId || c.stateId === selectedStateId
  );
  const cityOptions = filteredCities.map((c) => ({ value: c.name, label: c.name }));

  const selectedCityId = masterCities.find((c) => c.name === formData.city)?.id;
  const filteredAreas = masterAreas.filter(
    (a) => !selectedCityId || a.cityId === selectedCityId
  );
  const areaOptions = filteredAreas.map((a) => ({ value: a.name, label: a.name }));

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    updateDraft({ country: value, state: "", city: "", area: "" });
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    updateDraft({ state: value, city: "", area: "" });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    updateDraft({ city: value, area: "" });
  };

  const getCountryCode = (countryName: string) => {
    const codes: Record<string, string> = {
      India: "+91",
      "United Arab Emirates": "+971",
      "Saudi Arabia": "+966",
      USA: "+1",
    };
    return codes[countryName] || "+91";
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const selectedArea = masterAreas.find((a) => a.name === value);

    if (selectedArea) {
      const parentCity = masterCities.find((c) => c.id === selectedArea.cityId);
      const parentState = parentCity
        ? masterStates.find((s) => s.id === parentCity.stateId)
        : null;
      const parentCountry = parentState
        ? masterCountries.find((c) => c.id === parentState.countryId)
        : null;

      updateDraft({
        area: value,
        city: parentCity ? parentCity.name : formData.city,
        state: parentState ? parentState.name : formData.state,
        country: parentCountry ? parentCountry.name : formData.country,
        pincode: selectedArea.pincode || formData.pincode,
        lat: selectedArea.lat ? parseFloat(selectedArea.lat) : formData.lat,
        lng: selectedArea.lng ? parseFloat(selectedArea.lng) : formData.lng,
      });
    } else {
      updateDraft({ area: value });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;

    // Auto-format phone number
    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(-10);
    }

    if (name === "category") {
      setShowNewCategoryInput(value === "OTHER_PROPOSE");
    }
    if (name === "clusterType") {
      setShowCustomCluster(value === "CUSTOM");
    }

    updateDraft({ [name]: value });
  };

  const handleHybridChange = (e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    if (name === "category") {
      setShowNewCategoryInput(value === "OTHER_PROPOSE");
    }
    if (name === "clusterType") {
      setShowCustomCluster(value === "CUSTOM");
    }
    updateDraft({ [name]: value });
  };

  const handleLocationSelect = async (coords: { lat: number; lng: number }) => {
    updateDraft({ lat: coords.lat, lng: coords.lng });

    // Reverse Geocoding
    try {
      setIsGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`
      );
      const data = await res.json();

      if (data && data.address) {
        const {
          suburb,
          neighbourhood,
          road,
          city,
          town,
          village,
          state,
          country,
          postcode,
        } = data.address;

        const geocodedArea = suburb || neighbourhood || road;
        const geocodedCity = city || town || village;
        const geocodedState = state;
        const geocodedCountry = country;

        let matchedCountry =
          masterCountries.find(
            (c) => c.name.toLowerCase() === geocodedCountry?.toLowerCase()
          )?.name || geocodedCountry;
        let matchedState =
          masterStates.find(
            (s) => s.name.toLowerCase() === geocodedState?.toLowerCase()
          )?.name || geocodedState;
        let matchedCity =
          masterCities.find(
            (c) => c.name.toLowerCase() === geocodedCity?.toLowerCase()
          )?.name || geocodedCity;
        let matchedArea = geocodedArea;

        let minDistance = Infinity;

        masterAreas.forEach((area) => {
          if (area.lat && area.lng) {
            const dist = calculateDistance(
              coords.lat,
              coords.lng,
              parseFloat(area.lat),
              parseFloat(area.lng)
            );
            if (dist < minDistance && dist < 5000) {
              minDistance = dist;
              matchedArea = area.name;

              const parentCity = masterCities.find((c) => c.id === area.cityId);
              if (parentCity) {
                matchedCity = parentCity.name;
                const parentState = masterStates.find((s) => s.id === parentCity.stateId);
                if (parentState) {
                  matchedState = parentState.name;
                  const parentCountry = masterCountries.find(
                    (c) => c.id === parentState.countryId
                  );
                  if (parentCountry) {
                    matchedCountry = parentCountry.name;
                  }
                }
              }
            }
          }
        });

        if (minDistance === Infinity) {
          const areaByName = masterAreas.find(
            (a) => a.name.toLowerCase() === geocodedArea?.toLowerCase()
          );
          if (areaByName) {
            matchedArea = areaByName.name;
            const parentCity = masterCities.find((c) => c.id === areaByName.cityId);
            if (parentCity) {
              matchedCity = parentCity.name;
              const parentState = masterStates.find((s) => s.id === parentCity.stateId);
              if (parentState) matchedState = parentState.name;
            }
          }
        }

        let minClusterDist = Infinity;
        let matchedCluster = "";

        masterClusters.forEach((cluster) => {
          if (cluster.lat && cluster.lng) {
            const dist = calculateDistance(
              coords.lat,
              coords.lng,
              parseFloat(cluster.lat),
              parseFloat(cluster.lng)
            );
            if (dist < minClusterDist && dist < 3000) {
              minClusterDist = dist;
              matchedCluster = cluster.name;
            }
          }
        });

        if (matchedCluster) setShowCustomCluster(false);

        updateDraft({
          area: matchedArea || formData.area,
          city: matchedCity || formData.city,
          state: matchedState || formData.state,
          country: matchedCountry || formData.country,
          clusterType: matchedCluster || formData.clusterType,
          pincode: postcode || formData.pincode,
          village: village || "",
          lat: coords.lat,
          lng: coords.lng,
        });
      }
    } catch (err) {
      console.error("Reverse geocoding failed", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleMapSearch = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!mapSearchQuery.trim()) return;

    try {
      setIsGeocoding(true);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
          mapSearchQuery
        )}&limit=1`
      );
      const data = await res.json();

      if (data && data[0]) {
        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        handleLocationSelect(coords);
      }
    } catch (err) {
      console.error("Map search failed", err);
    } finally {
      setIsGeocoding(false);
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!formData.name || !formData.category) {
        setLocalError("Shop name and category are required.");
        return;
      }
      if (formData.category === "OTHER_PROPOSE" && !proposedCategory.trim()) {
        setLocalError("Please enter your proposed market category.");
        return;
      }
    }
    if (currentStep === 2) {
      if (!formData.city || !formData.phone || !formData.ownerEmail) {
        setLocalError("City, WhatsApp number, and Owner Email are required.");
        return;
      }

      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(formData.phone.replace(/\s+/g, ""))) {
        setLocalError("Please enter a valid 10-digit WhatsApp number.");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.ownerEmail)) {
        setLocalError("Please enter a valid email address.");
        return;
      }
    }
    setLocalError(null);
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const prevStep = () => {
    setLocalError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const internalSubmit = async () => {
    if (currentStep < totalSteps) {
      nextStep();
      return;
    }

    setLocalError(null);
    setUploadStatus("Processing uploads...");

    try {
      const slug = slugify(formData.name);
      const timestamp = Date.now();

      let logoUrl = formData.logo || "";
      if (logoFile) {
        setUploadStatus("Uploading logo...");
        const path = `shops/${slug}/logo_${timestamp}.jpg`;
        logoUrl = await uploadImage(logoFile, path);
      }

      let coverUrl = formData.coverImage || "";
      if (coverFile) {
        setUploadStatus("Uploading cover image...");
        const path = `shops/${slug}/cover_${timestamp}.jpg`;
        coverUrl = await uploadImage(coverFile, path);
      }

      let finalCategory = formData.category;
      if (formData.category === "OTHER_PROPOSE" && proposedCategory.trim()) {
        finalCategory = proposedCategory.trim();
        await proposeCategory(finalCategory);
      }

      let finalCluster = formData.clusterType;
      if (formData.clusterType === "CUSTOM" && proposedCluster.trim()) {
        finalCluster = proposedCluster.trim();
        await proposeCluster(finalCluster, finalCategory, formData.area, formData.city);
      }

      let cleanMapEmbed = formData.mapEmbed || "";
      if (cleanMapEmbed.includes("<iframe")) {
        const srcMatch = cleanMapEmbed.match(/src="([^"]+)"/);
        if (srcMatch && srcMatch[1]) cleanMapEmbed = srcMatch[1];
      }

      let lat = formData.lat;
      let lng = formData.lng;

      if (!lat || !lng) {
        try {
          setUploadStatus("Geocoding address...");
          const addressStr = `${formData.shopNo || ""}, ${formData.building || ""}, ${formData.zone || ""
            }, ${formData.village || ""}, ${formData.area || ""}, ${formData.city}, ${formData.state
            }, India`;
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
              addressStr
            )}&limit=1`
          );
          const geoData = await geoRes.json();
          if (geoData && geoData[0]) {
            lat = parseFloat(geoData[0].lat);
            lng = parseFloat(geoData[0].lon);
          }
        } catch (err) {
          console.error("Geocoding failed:", err);
        }
      }

      await onSubmit({
        ...formData,
        mapEmbed: cleanMapEmbed,
        category: finalCategory,
        clusterType: finalCluster,
        logo: logoUrl,
        coverImage: coverUrl,
        lat,
        lng,
        slug,
        proposedCategory: formData.category === "OTHER_PROPOSE",
        proposedCluster: formData.clusterType === "CUSTOM",
      });

      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error(err);
      setLocalError("Failed to process uploads. Please try again.");
    } finally {
      setUploadStatus("");
    }
  };

  const displayError = externalError || localError;

  return (
    <div className="w-full p-4 md:p-8 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 shadow-sm animate-in fade-in duration-300">
      {/* Draft notice */}
      {draftLoadedAtMount && currentStep === 1 && (
        <div className="max-w-3xl mx-auto mb-6 bg-amber-50 border border-amber-200 rounded-md p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500 dark:bg-amber-500/10 dark:border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 dark:bg-amber-500/20 dark:text-amber-400">
              <Sparkles size={16} />
            </div>
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              We found a saved draft. You can continue with it or start over.
            </p>
          </div>
          <button
            type="button"
            onClick={clearDraft}
            className="text-[11px] font-bold text-amber-700 dark:text-amber-450 uppercase tracking-wider hover:text-amber-900 dark:hover:text-amber-300 transition-colors shrink-0 cursor-pointer"
          >
            Clear Draft
          </button>
        </div>
      )}

      {/* Progress steps */}
      <div className="max-w-2xl mx-auto mb-10 relative px-4">
        <div className="absolute top-[18px] left-0 w-full h-[1px] bg-zinc-200 dark:bg-zinc-800 -z-0">
          <div
            className="h-full bg-[#FF6A00] transition-all duration-700 ease-in-out"
            style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          />
        </div>
        <div className="relative flex justify-between z-10">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-md flex items-center justify-center font-bold text-xs transition-all duration-500 ${currentStep > i + 1
                  ? "bg-[#FF6A00] text-white"
                  : currentStep === i + 1
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg scale-110"
                    : "bg-white text-zinc-400 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-500"
                  }`}
              >
                {currentStep > i + 1 ? <CircleCheckBig size={16} /> : i + 1}
              </div>
              <div className="absolute top-10 flex flex-col items-center whitespace-nowrap">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest transition-colors duration-300 ${currentStep === i + 1
                    ? "text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-400 dark:text-zinc-650"
                    }`}
                >
                  {step.title}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* Error display */}
        {displayError && (
          <div className="bg-red-50 rounded-md p-4 flex items-start gap-4 border border-red-100 animate-in shake duration-300 dark:bg-red-500/10 dark:border-red-500/20">
            <div className="w-10 h-10 rounded-md bg-red-100 flex items-center justify-center text-red-500 shrink-0 dark:bg-red-500/20">
              <CircleAlert size={20} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-1">
                Attention Required
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed">
                {displayError}
              </p>
            </div>
          </div>
        )}

        {/* Step 1 */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-2">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight mb-1">
                Business Identity
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Define your store name, category, and core specialties.
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <div>
                  <ImageUpload
                    onSelect={(file) => {
                      setLogoFile(file);
                      setLogoPreview(file ? URL.createObjectURL(file) : "");
                    }}
                    currentImage={logoPreview}
                    className="w-full h-32"
                    label="Store Logo"
                  />
                </div>
                <div className="md:col-span-2">
                  <ImageUpload
                    label="Background Cover Image"
                    onSelect={(file) => {
                      setCoverFile(file);
                      setCoverPreview(file ? URL.createObjectURL(file) : "");
                    }}
                    className="w-full h-32"
                    currentImage={coverPreview}
                    helpText="Recommended size: 1200x400. Appears as banner on profile."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <div className="md:col-span-1">
                  <Input
                    label="Business Name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g., Sharma Premium Groceries"
                    required
                    helpText="This will define your unique ShopBajar URL"
                  />
                </div>

                <div className="md:col-span-1 space-y-3">
                  <HybridSelect
                    label="Market Category"
                    name="category"
                    value={formData.category}
                    onChange={handleHybridChange}
                    required
                    options={[
                      { value: "", label: "Select a category", disabled: true },
                      ...dbCategories.map((c) => ({ value: c, label: c })),
                      { value: "OTHER_PROPOSE", label: "➕ Propose new category..." },
                    ]}
                    showInput={showNewCategoryInput}
                    onToggleInput={setShowNewCategoryInput}
                    inputName="proposedCategory"
                    inputValue={proposedCategory}
                    onInputChange={(e) => setProposedCategory(e.target.value)}
                    inputPlaceholder="e.g., Organic Lifestyle"
                    inputHelpText="We will review and add this to our directory"
                  />
                </div>

                <div className="md:col-span-1">
                  <Select
                    label="Service Model"
                    name="businessType"
                    value={formData.businessType}
                    onChange={handleChange}
                    required
                    options={[
                      { value: "product", label: "Product Based (Retail, Grocery)" },
                      { value: "service", label: "Service Based (Salon, Repair)" },
                      { value: "mixed", label: "Hybrid (Both Products & Services)" },
                    ]}
                  />
                </div>
              </div>

              <Textarea
                label="Store Description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="What makes your store unique? Mention your best-sellers or specialties..."
                required
                rows={3}
                helpText="A brief overview of your business for search results."
              />
            </div>
          </div>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div className="w-10 h-10 rounded-md bg-[#FF6A00]/10 flex items-center justify-center text-[#FF6A00]">
                  <MapIcon size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Shop Location
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Pin your shop accurately for customers to find you on live maps.
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200/80 dark:border-zinc-800 overflow-hidden relative shadow-sm">
                <div className="absolute top-4 left-4 right-4 z-[400] flex gap-2">
                  <div className="flex-1 relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-[#FF6A00] transition-colors">
                      <Search size={14} />
                    </div>
                    <input
                      type="text"
                      placeholder="Search for area, building or street..."
                      value={mapSearchQuery}
                      onChange={(e) => setMapSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleMapSearch(e)}
                      className="w-full h-9 pl-9 pr-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-700 rounded-md text-xs font-medium shadow-lg focus:outline-none focus:ring-1 focus:ring-[#FF6A00]/40 transition-all dark:text-zinc-100"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleMapSearch()}
                    className="h-9 px-4 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md font-bold text-xs shadow-lg hover:bg-[#FF6A00] dark:hover:bg-[#FF6A00] dark:hover:text-white transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    Find
                  </button>
                </div>

                <MapComponent
                  height="280px"
                  center={{
                    lat: formData.lat || 23.0225,
                    lng: formData.lng || 72.5714,
                  }}
                  onLocationSelect={handleLocationSelect}
                />

                <div className="absolute bottom-4 left-4 right-4 z-[400] flex justify-between items-end pointer-events-none">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!navigator.geolocation) return alert("Geolocation not supported");
                      setIsGeocoding(true);
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          handleLocationSelect({
                            lat: pos.coords.latitude,
                            lng: pos.coords.longitude,
                          });
                        },
                        () => setIsGeocoding(false)
                      );
                    }}
                    className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-md text-xs font-bold shadow-lg hover:text-[#FF6A00] dark:hover:text-[#FF6A00] transition-all active:scale-95 border border-zinc-200/80 dark:border-zinc-700 cursor-pointer"
                  >
                    <Navigation size={14} className="text-[#FF6A00]" />
                    Use Current Location
                  </button>

                  {isGeocoding && (
                    <div className="pointer-events-auto bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-3 py-2 rounded-md shadow-lg flex items-center gap-2 border border-zinc-200/80 dark:border-zinc-700">
                      <Loader2 size={14} className="animate-spin text-[#FF6A00]" />
                      <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100">
                        Smart Locating...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div className="w-10 h-10 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Address Details
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Verify and complete your business address details.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start">
                <Input
                  label="Shop Number (Optional)"
                  name="shopNo"
                  value={formData.shopNo}
                  onChange={handleChange}
                  placeholder="e.g. Shop G-12"
                />
                <Input
                  label="Building / Complex"
                  name="building"
                  value={formData.building}
                  onChange={handleChange}
                  placeholder="e.g. Skyline Corporate Park"
                />
                <Select
                  label="Country"
                  name="country"
                  value={formData.country}
                  onChange={handleCountryChange}
                  required
                  options={[{ value: "", label: "Select Country" }, ...countryOptions]}
                />
                <Select
                  label="State"
                  name="state"
                  value={formData.state}
                  onChange={handleStateChange}
                  required
                  options={[{ value: "", label: "Select State" }, ...stateOptions]}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start pt-2">
                <Select
                  label="City"
                  name="city"
                  value={formData.city}
                  onChange={handleCityChange}
                  required
                  options={[{ value: "", label: "Select City" }, ...cityOptions]}
                />
                <Select
                  label="Area / Locality"
                  name="area"
                  value={formData.area}
                  onChange={handleAreaChange}
                  required
                  options={[{ value: "", label: "Select Area" }, ...areaOptions]}
                />
                <Input
                  label="Pincode"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  placeholder="e.g. 380060"
                  required
                />
                <Input
                  label="Village / Sub-area"
                  name="village"
                  value={formData.village}
                  onChange={handleChange}
                  placeholder="e.g. Chenpur"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowMoreAddress(!showMoreAddress)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#FF6A00] hover:underline cursor-pointer"
                >
                  <Plus
                    size={14}
                    className={`transition-transform duration-300 ${showMoreAddress ? "rotate-45" : ""
                      }`}
                  />
                  {showMoreAddress
                    ? "Hide additional details"
                    : "Add landmark & business cluster"}
                </button>

                {showMoreAddress && (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-4 duration-300 items-start">
                    <Input
                      label="Landmark"
                      name="zone"
                      value={formData.zone}
                      onChange={handleChange}
                      placeholder="e.g. Opp. Reliance Fresh"
                    />
                    <HybridSelect
                      label="Market / Business Area (Optional)"
                      name="clusterType"
                      value={formData.clusterType}
                      onChange={handleHybridChange}
                      options={[
                        { value: "", label: "Select Business Area" },
                        ...masterClusters.map((c) => ({
                          value: c.name,
                          label: c.name,
                        })),
                        { value: "CUSTOM", label: "Other / Propose New Market Area" },
                      ]}
                      helpText="Groups your business with similar local hubs."
                      showInput={showCustomCluster}
                      onToggleInput={setShowCustomCluster}
                      inputName="proposedCluster"
                      inputValue={proposedCluster}
                      onInputChange={(e) => setProposedCluster(e.target.value)}
                      inputPlaceholder="e.g. Navrangpura Commercial Hub"
                      inputHelpText="Our team will review and add this market to the discovery engine."
                    />
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <Input
                  label="WhatsApp For Business"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="9876543210"
                  required
                  prefix={getCountryCode(formData.country)}
                  helpText="Customers will reach out to you on this number"
                />
                <Input
                  label="Owner Email Address"
                  name="ownerEmail"
                  type="email"
                  value={formData.ownerEmail}
                  onChange={handleChange}
                  placeholder="owner@example.com"
                  required
                  icon={Mail}
                  helpText="Used for business verification and updates"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-md bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <Globe size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    Discovery & SEO
                  </h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    How your shop appears to customers online.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-805 border border-zinc-200/80 dark:border-zinc-700/80 rounded-md space-y-3 shadow-sm flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    <LinkIcon size={12} />
                    Live SEO URL Preview
                  </div>
                  <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 break-all">
                    shopbajar.com/
                    <span className="text-[#FF6A00]">{slugify(formData.city || "city")}/</span>
                    <span className="text-[#FF6A00]">{slugify(formData.area || "area")}/</span>
                    <span className="text-[#FF6A00] font-bold">
                      {slugify(formData.name || "shop-name")}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-zinc-900 dark:bg-zinc-100 rounded-md space-y-3 shadow-sm flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">
                    <Eye size={12} />
                    Marketplace Discovery
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-650">
                      Your shop will appear under:
                    </p>
                    <p className="text-xs font-bold text-white dark:text-zinc-900 flex items-center gap-2">
                      <Sparkles size={14} className="text-[#FF6A00]" />
                      {formData.category || "Select Category"}s in{" "}
                      {formData.area || "Select Area"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-800 dark:from-zinc-800 dark:to-zinc-700 rounded-md text-white relative overflow-hidden shadow-sm w-full">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <ShieldCheck size={100} />
              </div>
              <div className="relative z-10 max-w-2xl">
                <h3 className="text-[10px] font-bold text-[#FF6A00] uppercase tracking-widest mb-2">
                  Final Registration
                </h3>
                <p className="text-base font-bold mb-4 tracking-tight leading-snug">
                  Your digital storefront is almost ready for launch.
                </p>
                <div className="flex flex-wrap items-center gap-6 text-xs font-bold opacity-80">
                  <div className="flex items-center gap-1.5">
                    <CircleCheckBig size={14} className="text-[#25D366]" />{" "}
                    <span>Free Listing</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CircleCheckBig size={14} className="text-[#25D366]" />{" "}
                    <span>Live Maps</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CircleCheckBig size={14} className="text-[#25D366]" />{" "}
                    <span>Direct WhatsApp</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={prevStep}
            icon={ChevronLeft}
            className={`w-full sm:w-auto h-10 ${currentStep === 1 ? "invisible" : ""}`}
          >
            Go Back
          </Button>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {currentStep < totalSteps ? (
              <Button
                type="button"
                variant="dark"
                size="lg"
                onClick={nextStep}
                className="w-full sm:w-auto h-10 shadow-sm"
                icon={ChevronRight}
                iconPosition="right"
              >
                Continue Next
              </Button>
            ) : (
              <Button
                type="button"
                onClick={internalSubmit}
                variant="primary"
                size="xl"
                disabled={isLoading || !!uploadStatus}
                loading={isLoading || !!uploadStatus}
                className="w-full sm:w-auto px-10 h-10 shadow-sm"
                icon={Save}
              >
                {uploadStatus || "Launch Storefront"}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default ShopForm;
