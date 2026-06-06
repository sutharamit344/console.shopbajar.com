import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getShopsByOwner, getShopById } from "@/lib/db";

export function useShopOwner() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPortal = window.location.pathname.startsWith("/portal") || searchParams.get("portal") === "true";

  useEffect(() => {
    if (isPortal) {
      const loadPortalShop = async () => {
        setLoading(true);
        const urlShopId = searchParams.get("shopId") || searchParams.get("id");
        
        if (urlShopId) {
          const s = await getShopById(urlShopId);
          if (!s) {
            setError("Shop not found");
          } else {
            setShop(s);
          }
        } else {
          setError("No Shop ID provided in the portal URL.");
        }
        setLoading(false);
      };
      loadPortalShop();
      return;
    }

    if (authLoading) return;
    if (!user) {
      navigate("/login" + window.location.search);
      return;
    }

    const loadShop = async () => {
      setLoading(true);
      const urlShopId = searchParams.get("shopId") || searchParams.get("id");
      
      if (urlShopId) {
        const s = await getShopById(urlShopId);
        if (!s) {
          setError("Shop not found");
        } else if (s.ownerId !== user.uid) {
          setError("You do not have permission to manage this shop.");
        } else {
          setShop(s);
        }
      } else {
        const shops = await getShopsByOwner(user.uid);
        if (shops.length > 0) {
          setShop(shops[0]);
          navigate(`?shopId=${shops[0].id}`, { replace: true });
        } else {
          setError("No shops registered. Please create a shop on the main dashboard.");
        }
      }
      setLoading(false);
    };

    loadShop();
  }, [user, authLoading, searchParams, navigate, isPortal]);

  return { shop, loading: isPortal ? loading : (loading || authLoading), error };
}
