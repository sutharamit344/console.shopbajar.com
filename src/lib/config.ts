export const BRAND = "ShopBajar";
export const DOMAIN = typeof window !== "undefined"
  ? window.location.origin
  : (import.meta.env.VITE_BASE_URL || "https://shopbajar.com");
export const MAIN_APP_URL = import.meta.env.VITE_MAIN_APP_URL || "https://shopbajar.com";
export const CONTACT = {
  phone: "+91 7976985175",
  email: "webiestindiasolution@gmail.com",
  whatsapp: "917976985175"
};
