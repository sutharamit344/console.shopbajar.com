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

export const getCustomerAppUrl = (path: string = "") => {
  let base = MAIN_APP_URL;
  if (typeof window !== "undefined") {
    const { hostname, port } = window.location;
    const isLocal = hostname === "localhost" || 
                    hostname === "127.0.0.1" || 
                    hostname.endsWith(".local") || 
                    /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname) ||
                    /^[0-9.]+$/.test(hostname) ||
                    port === "5173" || 
                    port === "5174" ||
                    port === "5175";
    if (isLocal) {
      let customerPort = "3000";
      try {
        const url = new URL(MAIN_APP_URL);
        if (url.port) {
          customerPort = url.port;
        }
      } catch (e) {
        // ignore
      }
      base = `http://${hostname}:${customerPort}`;
    }
  }
  const cleanBase = base.replace(/\/$/, "");
  const cleanPath = path.replace(/^\//, "");
  return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
};
