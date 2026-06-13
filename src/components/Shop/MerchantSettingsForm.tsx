import React, { useState, useEffect } from "react";
import { slugify } from "../../lib/slugify";
import { uploadImage } from "../../lib/storage";
import { proposeCategory, proposeCluster, isSlugAvailable } from "../../lib/db";
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
  CircleAlert,
  Plus,
  Loader2,
  Navigation,
  Sparkles,
  Eye,
  LinkIcon,
  MapIcon,
  Search,
  Mail,
  Globe,
  Store,
  Phone,
  Share2,
  Trash2,
} from "lucide-react";

const Instagram = (props: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
const Facebook = (props: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);
const Youtube = (props: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </svg>
);
const Twitter = (props: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
  </svg>
);
const Linkedin = (props: any) => (
  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

interface MerchantSettingsFormProps {
  initialData: any;
  onSubmit: (data: any) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  sectionRefs?: React.RefObject<Record<string, HTMLElement | null>>;
}

const MerchantSettingsForm: React.FC<MerchantSettingsFormProps> = ({
  initialData,
  onSubmit,
  isLoading = false,
  error: externalError,
  sectionRefs,
}) => {
  const dispatch = useDispatch<AppDispatch>();

  // Master Data from Redux
  const masterCategories = useSelector(selectMasterCategories) || [];
  const masterClusters = useSelector(selectMasterClusters) || [];
  const masterCountries = useSelector(selectMasterCountries) || [];
  const masterStates = useSelector(selectMasterStates) || [];
  const masterCities = useSelector(selectMasterCities) || [];
  const masterAreas = useSelector(selectMasterAreas) || [];

  const [localError, setLocalError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");

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
    slug: "",
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
    qrOrderingConfig: {
      requireWaiterApproval: false,
    },
    staffPin: "1234",
  });

  const [slugStatus, setSlugStatus] = useState("idle"); // 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [proposedCategory, setProposedCategory] = useState("");
  const [showCustomCluster, setShowCustomCluster] = useState(false);
  const [proposedCluster, setProposedCluster] = useState("");
  const [showMoreAddress, setShowMoreAddress] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [mapSearchQuery, setMapSearchQuery] = useState("");

  // Fetch Master Directory on Mount
  useEffect(() => {
    dispatch(fetchMasterDirectory());
  }, [dispatch]);

  // Load initialData on mount
  useEffect(() => {
    if (initialData) {
      setFormData((prev: any) => ({
        ...prev,
        staffPin: "1234",
        ...initialData,
        socialLinks: Array.isArray(initialData.socialLinks) ? initialData.socialLinks : [],
        qrOrderingConfig: {
          requireWaiterApproval: initialData.qrOrderingConfig?.requireWaiterApproval ?? false,
        },
      }));
      setLogoPreview(initialData.logo || "");
      setCoverPreview(initialData.coverImage || "");
    }
  }, [initialData]);

  // Check for custom category once master data loads
  useEffect(() => {
    if (initialData && masterCategories.length > 0) {
      const allCatNames = masterCategories.map((c) => c.name);
      if (initialData.category && !allCatNames.includes(initialData.category)) {
        setFormData((prev: any) => ({ ...prev, category: "OTHER_PROPOSE" }));
        setProposedCategory(initialData.category);
        setShowNewCategoryInput(true);
      }
    }
  }, [initialData, masterCategories]);

  // Debounced slug availability check
  useEffect(() => {
    if (!formData.slug || formData.slug.trim() === "") {
      setSlugStatus("idle");
      return;
    }

    const cleanSlug = formData.slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      setSlugStatus("invalid");
      return;
    }

    setSlugStatus("checking");

    const timer = setTimeout(async () => {
      const isAvailable = await isSlugAvailable(cleanSlug, initialData?.id || null);
      if (isAvailable) {
        setSlugStatus("available");
      } else {
        setSlugStatus("taken");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.slug, initialData]);

  // Check for custom cluster once master data loads
  useEffect(() => {
    if (initialData && masterClusters.length > 0) {
      const allClusterNames = masterClusters.map((c) => c.name);
      if (initialData.clusterType && !allClusterNames.includes(initialData.clusterType)) {
        setShowCustomCluster(true);
        setProposedCluster(initialData.clusterType);
      }
    }
  }, [initialData, masterClusters]);

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
    setFormData((prev: any) => ({ ...prev, country: value, state: "", city: "", area: "" }));
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setFormData((prev: any) => ({ ...prev, state: value, city: "", area: "" }));
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    setFormData((prev: any) => ({ ...prev, city: value, area: "" }));
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

      setFormData((prev: any) => ({
        ...prev,
        area: value,
        city: parentCity ? parentCity.name : prev.city,
        state: parentState ? parentState.name : prev.state,
        country: parentCountry ? parentCountry.name : prev.country,
        pincode: selectedArea.pincode || prev.pincode,
        lat: selectedArea.lat ? parseFloat(selectedArea.lat) : prev.lat,
        lng: selectedArea.lng ? parseFloat(selectedArea.lng) : prev.lng,
      }));
    } else {
      setFormData((prev: any) => ({ ...prev, area: value }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let { name, value } = e.target;

    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(-10);
    }

    if (name === "category") {
      setShowNewCategoryInput(value === "OTHER_PROPOSE");
    }
    if (name === "clusterType") {
      setShowCustomCluster(value === "CUSTOM");
    }

    if (name === "slug") {
      const cleanSlug = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      setFormData((prev: any) => ({ ...prev, slug: cleanSlug }));
      return;
    }

    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleHybridChange = (e: { target: { name: string; value: string } }) => {
    const { name, value } = e.target;
    if (name === "category") {
      setShowNewCategoryInput(value === "OTHER_PROPOSE");
    }
    if (name === "clusterType") {
      setShowCustomCluster(value === "CUSTOM");
    }
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  // Social Links Handlers
  const socialPlatforms = [
    { value: "instagram", label: "Instagram", icon: Instagram },
    { value: "facebook", label: "Facebook", icon: Facebook },
    { value: "youtube", label: "YouTube", icon: Youtube },
    { value: "twitter", label: "Twitter / X", icon: Twitter },
    { value: "linkedin", label: "LinkedIn", icon: Linkedin },
    { value: "website", label: "Custom Website", icon: Globe },
  ];

  const getPlatformIcon = (platform: string) => {
    const found = socialPlatforms.find((p) => p.value === platform);
    if (!found) return Globe;
    return found.icon;
  };

  const handleAddSocialLink = () => {
    setFormData((prev: any) => ({
      ...prev,
      socialLinks: [...(prev.socialLinks || []), { platform: "instagram", url: "" }],
    }));
  };

  const handleRemoveSocialLink = (index: number) => {
    setFormData((prev: any) => ({
      ...prev,
      socialLinks: (prev.socialLinks || []).filter((_: any, i: number) => i !== index),
    }));
  };

  const handleSocialLinkChange = (index: number, field: string, value: string) => {
    setFormData((prev: any) => {
      const updated = [...(prev.socialLinks || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, socialLinks: updated };
    });
  };

  const handleSocialUrlBlur = (index: number, value: string) => {
    if (!value || value.trim() === "") return;
    let cleanUrl = value.trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl;
    }
    handleSocialLinkChange(index, "url", cleanUrl);
  };

  const handleLocationSelect = async (coords: { lat: number; lng: number }) => {
    setFormData((prev: any) => ({ ...prev, lat: coords.lat, lng: coords.lng }));

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

        setFormData((prev: any) => ({
          ...prev,
          area: matchedArea || prev.area,
          city: matchedCity || prev.city,
          state: matchedState || prev.state,
          country: matchedCountry || prev.country,
          clusterType: matchedCluster || prev.clusterType,
          pincode: postcode || prev.pincode,
          village: village || "",
          lat: coords.lat,
          lng: coords.lng,
        }));
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

  const validateForm = () => {
    if (!formData.name || !formData.category) {
      setLocalError("Shop name and category are required.");
      return false;
    }
    if (formData.category === "OTHER_PROPOSE" && !proposedCategory.trim()) {
      setLocalError("Please enter your proposed market category.");
      return false;
    }
    if (!formData.city || !formData.phone || !formData.ownerEmail) {
      setLocalError("City, WhatsApp number, and Owner Email are required.");
      return false;
    }

    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s+/g, ""))) {
      setLocalError("Please enter a valid 10-digit WhatsApp number.");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.ownerEmail)) {
      setLocalError("Please enter a valid email address.");
      return false;
    }

    if (formData.staffPin && formData.staffPin.length !== 4) {
      setLocalError("Staff Access PIN must be exactly 4 digits.");
      return false;
    }

    if (!formData.slug || formData.slug.trim() === "") {
      setLocalError("Shop URL slug is required.");
      return false;
    }
    if (slugStatus === "taken") {
      setLocalError("This shop URL is already taken. Please choose another one.");
      return false;
    }
    if (slugStatus === "invalid") {
      setLocalError("Invalid URL slug. Only lowercase letters, numbers, and hyphens are allowed.");
      return false;
    }
    if (slugStatus === "checking") {
      setLocalError("Checking URL availability... Please wait.");
      return false;
    }

    setLocalError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setLocalError(null);
    setUploadStatus("Processing uploads...");

    try {
      const slug = formData.slug || slugify(formData.name);
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

      // Filter out empty social links
      const cleanSocialLinks = (formData.socialLinks || []).filter(
        (link: any) => link.url && link.url.trim() !== ""
      );

      await onSubmit({
        ...formData,
        socialLinks: cleanSocialLinks,
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
    } catch (err) {
      console.error(err);
      setLocalError("Failed to update business details. Please try again.");
    } finally {
      setUploadStatus("");
    }
  };

  const displayError = externalError || localError;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      {/* ── ERROR DISPLAY ── */}
      {displayError && (
        <div className="bg-red-50 rounded-md p-4 flex items-start gap-4 border border-red-100 animate-in shake duration-300 dark:bg-red-500/10 dark:border-red-500/20 shadow-sm">
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

      {/* ── SECTION 1: BUSINESS IDENTITY ── */}
      <div
        ref={(el) => {
          if (sectionRefs?.current) sectionRefs.current["identity"] = el;
        }}
        className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-sm space-y-4 scroll-mt-20"
      >
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-[#FF6A00]/10 flex items-center justify-center text-[#FF6A00]">
            <Store size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Business Identity
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Define your store branding, name, category, and core specialties.
            </p>
          </div>
        </div>

        {/* Image Upload Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
          <div>
            <ImageUpload
              onSelect={(file) => {
                setLogoFile(file);
                setLogoPreview(file ? URL.createObjectURL(file) : "");
              }}
              currentImage={logoPreview}
              className="w-full h-28"
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
              className="w-full h-28"
              currentImage={coverPreview}
              helpText="Recommended size: 1200x400. Appears as banner on profile."
            />
          </div>
        </div>

        {/* Business Name & Custom URL Slug Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
          <Input
            label="Business Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Sharma Premium Groceries"
            required
          />
          
          <div className="space-y-1">
            <Input
              label="Custom Shop URL"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              placeholder="sharma-premium-groceries"
              required
              helpText={
                slugStatus === "checking" ? (
                  <span className="text-zinc-555 flex items-center gap-1.5"><Loader2 className="animate-spin text-[#FF6A00]" size={12} /> Checking availability...</span>
                ) : slugStatus === "available" ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">✓ URL is available</span>
                ) : slugStatus === "taken" ? (
                  <span className="text-red-500 font-semibold flex items-center gap-1">✗ Already taken by another shop</span>
                ) : slugStatus === "invalid" ? (
                  <span className="text-amber-600 flex items-center gap-1">⚠ Only lowercase letters, numbers, and hyphens allowed</span>
                ) : (
                  "Only lowercase letters, numbers, and hyphens allowed"
                )
              }
            />
          </div>
        </div>

        {/* Categorization & Service Model Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
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

        {/* Store Description */}
        <Textarea
          label="Store Description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="What makes your store unique? Mention your best-sellers or specialties..."
          required
          rows={2}
          helpText="A brief overview of your business for search results."
        />
      </div>

      {/* ── SECTION 2: LOCATION & ADDRESS ── */}
      <div
        ref={(el) => {
          if (sectionRefs?.current) sectionRefs.current["location"] = el;
        }}
        className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-sm space-y-4 scroll-mt-20"
      >
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-blue-500/10 flex items-center justify-center text-blue-500">
            <MapIcon size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Location & Address
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Pin your shop accurately and complete your physical address details.
            </p>
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200/80 dark:border-zinc-800 overflow-hidden relative shadow-sm">
          {/* Map Search Overlay */}
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
              className="h-9 px-4 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md font-bold text-xs shadow-lg hover:bg-[#FF6A00] dark:hover:bg-[#FF6A00] dark:hover:text-white transition-all active:scale-95 flex items-center gap-2"
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
              className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-md text-xs font-bold shadow-lg hover:text-[#FF6A00] dark:hover:text-[#FF6A00] transition-all active:scale-95 border border-zinc-200/80 dark:border-zinc-700"
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

        {/* 4-Column Grid for Address Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start pt-2">
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

        {/* Expandable Section */}
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
            {showMoreAddress ? "Hide additional details" : "Add landmark & business cluster"}
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
      </div>

      {/* ── SECTION 3: CONTACT DETAILS ── */}
      <div
        ref={(el) => {
          if (sectionRefs?.current) sectionRefs.current["contact"] = el;
        }}
        className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-sm space-y-4 scroll-mt-20"
      >
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <Phone size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Contact Details
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Provide your primary communication channels for customers and notifications.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
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
          <Input
            label="Staff Access PIN (4 Digits)"
            name="staffPin"
            value={formData.staffPin || ""}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              setFormData((prev: any) => ({ ...prev, staffPin: val }));
            }}
            placeholder="1234"
            maxLength={4}
            helpText="Security PIN for sharing authentication-free staff URLs"
          />
        </div>
      </div>

      {/* ── SECTION 3.5: SOCIAL & WEB PRESENCE ── */}
      <div
        ref={(el) => {
          if (sectionRefs?.current) sectionRefs.current["social"] = el;
        }}
        className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-sm space-y-4 scroll-mt-20"
      >
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-pink-500/10 flex items-center justify-center text-pink-500">
            <Share2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Social & Web Presence
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Add links to your social media profiles and website to build trust and drive engagement.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {(formData.socialLinks || []).map((link: any, index: number) => {
            const PlatformIcon = getPlatformIcon(link.platform);
            return (
              <div
                key={index}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200/80 dark:border-zinc-700/80 animate-in fade-in duration-300 shadow-sm"
              >
                <div className="w-full sm:w-48 shrink-0">
                  <Select
                    label=""
                    name={`platform-${index}`}
                    value={link.platform}
                    onChange={(e) => handleSocialLinkChange(index, "platform", e.target.value)}
                    options={socialPlatforms.map((p) => ({ value: p.value, label: p.label }))}
                    className="h-9 mb-0"
                  />
                </div>
                <div className="flex-1 relative flex items-center">
                  <div className="absolute left-3 text-zinc-400 dark:text-zinc-500 pointer-events-none">
                    <PlatformIcon size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="https://instagram.com/yourshop"
                    value={link.url}
                    onChange={(e) => handleSocialLinkChange(index, "url", e.target.value)}
                    onBlur={(e) => handleSocialUrlBlur(index, e.target.value)}
                    className="w-full h-9 pl-10 pr-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 rounded-md text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#FF6A00]/40 transition-all dark:text-zinc-100 shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveSocialLink(index)}
                  className="w-full sm:w-9 h-9 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 rounded-md flex items-center justify-center transition-colors shrink-0 shadow-sm active:scale-95 cursor-pointer"
                  title="Remove Link"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddSocialLink}
            className="w-full py-3 px-4 border-2 border-dashed border-zinc-200 hover:border-[#FF6A00]/40 dark:border-zinc-800 dark:hover:border-[#FF6A00]/40 rounded-md flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 hover:text-[#FF6A00] dark:text-zinc-400 dark:hover:text-[#FF6A00] transition-all bg-transparent hover:bg-[#FF6A00]/5 dark:hover:bg-[#FF6A00]/5 active:scale-[0.99] cursor-pointer"
          >
            <Plus size={16} />
            Add Social Media Link
          </button>
        </div>
      </div>

      {/* ── SECTION 4: DISCOVERY & SEO ── */}
      <div
        ref={(el) => {
          if (sectionRefs?.current) sectionRefs.current["seo"] = el;
        }}
        className="bg-white dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-sm space-y-4 scroll-mt-20"
      >
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-purple-500/10 flex items-center justify-center text-purple-500">
            <Globe size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              Discovery & SEO
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Preview how your business profile appears across the ShopBajar discovery engine.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/80 rounded-md space-y-3 shadow-sm flex flex-col justify-center">
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
                {formData.category || "Select Category"}s in {formData.area || "Select Area"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Save Action Bar */}
      <div className="flex items-center justify-end gap-3 pt-3 sticky bottom-2 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-3 rounded-md border border-zinc-200/80 dark:border-zinc-800 shadow-lg">
        <Button
          type="submit"
          variant="primary"
          size="xl"
          disabled={isLoading || !!uploadStatus}
          loading={isLoading || !!uploadStatus}
          className="px-10 h-10 shadow-sm"
          icon={Save}
        >
          {uploadStatus || "Save Configuration"}
        </Button>
      </div>
    </form>
  );
};

export default MerchantSettingsForm;
