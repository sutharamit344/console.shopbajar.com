import {
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp,
  orderBy,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  runTransaction,
  deleteDoc
} from "firebase/firestore";
import { db } from "./firebase";

export { db };

const COLLECTION_NAME = "shops";
const LOGS_COLLECTION = "activity_logs";
const BILLS_COLLECTION = "bills";

function serializeTimestamps(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => serializeTimestamps(item));
  }

  if (typeof obj.toDate === "function") {
    return obj.toDate().toISOString();
  }

  const serialized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    serialized[key] = serializeTimestamps(value);
  }
  return serialized;
}

function evaluatePaidFeatures(paidFeatures: any) {
  if (!paidFeatures || typeof paidFeatures !== "object") return paidFeatures;
  const now = new Date();
  const evaluated = { ...paidFeatures };
  for (const [key, feature] of Object.entries(evaluated)) {
    if (feature && typeof feature === "object") {
      const expiresAt = (feature as any).expiresAt;
      if (expiresAt && new Date(expiresAt) < now) {
        evaluated[key] = {
          ...(feature as any),
          enabled: false,
          isExpired: true, // Flag it as expired so the UI can show Renew option
        };
      }
    }
  }
  return evaluated;
}

function standardizeData(docSnap: any) {
  if (!docSnap.exists || !docSnap.exists()) return null;
  const data = serializeTimestamps(docSnap.data());
  if (data && data.paidFeatures) {
    data.paidFeatures = evaluatePaidFeatures(data.paidFeatures);
  }
  return {
    id: docSnap.id,
    ...data,
  };
}


/**
 * Log merchant activity
 */
export async function logActivity(
  action: string,
  details: string,
  entityId: string,
  entityType = "shop",
  performedBy = "Merchant",
) {
  try {
    await addDoc(collection(db, LOGS_COLLECTION), {
      action,
      details,
      entityId,
      entityType,
      performedBy,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error logging activity:", error);
  }
}

/**
 * Saves a new shop to Firestore. (Not cached)
 */
export async function saveShop(shopData: any) {
  try {
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...shopData,
      status: "pending",
      createdAt: serverTimestamp(),
      ownerId: shopData.ownerId || null,
      ownerEmail: shopData.ownerEmail || null,
    });

    // Log the action
    await logActivity(
      "CREATE",
      `New shop "${shopData.name}" submitted.`,
      docRef.id,
      "shop",
      shopData.ownerEmail || "Merchant",
    );

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding document: ", error);
    return { success: false, error };
  }
}

/**
 * Gets all shops owned by a specific user.
 */
export async function getShopsByOwner(ownerId: string): Promise<any[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where("ownerId", "==", ownerId),
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map((docSnap) => {
      const data = docSnap.data() as any;
      if (data.paidFeatures) {
        data.paidFeatures = evaluatePaidFeatures(data.paidFeatures);
      }
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()
          ? data.createdAt.toDate().toISOString()
          : null,
      };
    });

    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch (error) {
    console.error("Error getting owner shops: ", error);
    return [];
  }
}


/**
 * Gets a single shop by ID.
 */
export async function getShopById(id: string): Promise<any | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    return standardizeData(docSnap);
  } catch (error) {
    console.error("Error getting shop by ID: ", error);
    return null;
  }
}

/**
 * Updates an existing shop.
 */
export async function updateShop(id: string, data: any) {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("Shop not found");
    const currentData = docSnap.data();

    const changedFields = Object.keys(data).filter(
      (key) => JSON.stringify(data[key]) !== JSON.stringify(currentData[key]),
    );
    const changeSummary =
      changedFields.length > 0
        ? `Updated: ${changedFields.join(", ")}`
        : "Revitalized profile (no field changes)";

    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });

    await logActivity(
      "UPDATE",
      changeSummary,
      id,
      "shop",
      auth.currentUser?.email || "Merchant",
    );
    return { success: true };
  } catch (error) {
    console.error("Error updating shop: ", error);
    return { success: false, error };
  }
}

import { auth } from "./firebase";

/**
 * Gets audit history logs for an entity
 */
export async function getEntityLogs(entityId: string, limitCount = 5): Promise<any[]> {
  try {
    const q = query(
      collection(db, LOGS_COLLECTION),
      where("entityId", "==", entityId),
      orderBy("timestamp", "desc"),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map(standardizeData).filter(Boolean);
  } catch (error) {
    console.error("Error fetching entity logs:", error);
    return [];
  }
}

/**
 * Deletes a rating and updates the aggregate average.
 */
export async function deleteShopRating(shopId: string, ratingId: string) {
  try {
    const shopRef = doc(db, COLLECTION_NAME, shopId);
    const ratingRef = doc(db, COLLECTION_NAME, shopId, "ratings", ratingId);

    await runTransaction(db, async (transaction) => {
      const shopSnap = await transaction.get(shopRef);
      const ratingSnap = await transaction.get(ratingRef);

      if (!shopSnap.exists()) throw new Error("Shop not found");
      if (!ratingSnap.exists()) throw new Error("Rating not found");

      const shopData = shopSnap.data();
      const ratingData = ratingSnap.data();

      const currentAvg = shopData.avgRating || 0;
      const currentTotal = shopData.totalRatings || 0;
      const deletedRating = ratingData.rating;

      let newTotal = currentTotal - 1;
      let newAvg = 0;

      if (newTotal > 0) {
        newAvg = (currentAvg * currentTotal - deletedRating) / newTotal;
      }

      // 1. Delete the rating document
      transaction.delete(ratingRef);

      // 2. Update the shop's aggregate rating metadata
      transaction.update(shopRef, {
        avgRating: parseFloat(newAvg.toFixed(1)),
        totalRatings: Math.max(0, newTotal),
      });

      // 3. Log the deletion
      logActivity(
        "RATING_DELETE",
        `Admin/Owner deleted a review from ${ratingData.userName}`,
        shopId,
        "shop",
        "System/Owner",
      );
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting rating: ", error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets recent ratings for a shop.
 */
export async function getShopRatings(shopId: string, limitCount = 10): Promise<any[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME, shopId, "ratings"),
      orderBy("createdAt", "desc"),
      limit(limitCount),
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(standardizeData).filter(Boolean);
  } catch (error) {
    console.error("Error getting shop ratings: ", error);
    return [];
  }
}

/**
 * ADMIN: MASTER FEATURES SYSTEM (SAAS ADD-ONS)
 */
export async function getMasterFeatures(includeInactive = false): Promise<any[]> {
  try {
    const constraints: any[] = [orderBy("createdAt", "asc")];
    if (!includeInactive) {
      constraints.push(where("status", "==", "active"));
    }
    const q = query(collection(db, "features"), ...constraints);
    const snap = await getDocs(q);
    return snap.docs.map(standardizeData).filter(Boolean);
  } catch (error) {
    console.error("Error getting master features:", error);
    return [];
  }
}

export async function getShopInquiries(shopId: string): Promise<any[]> {
  try {
    const q = query(
      collection(db, "inquiries"),
      where("shopId", "==", shopId)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map(standardizeData).filter(Boolean);
    return results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (error) {
    console.error("Error getting shop inquiries: ", error);
    return [];
  }
}

export async function updateInquiryStatus(id: string, newStatus: string) {
  try {
    const docRef = doc(db, "inquiries", id);
    await updateDoc(docRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error updating inquiry status: ", error);
    return { success: false, error: error.message };
  }
}

export async function updateInquiryItems(id: string, items: any[], totalAmount: number) {
  try {
    const docRef = doc(db, "inquiries", id);
    await updateDoc(docRef, {
      items,
      totalAmount,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error updating inquiry items: ", error);
    return { success: false, error: error.message };
  }
}

/**
 * BILLING MANAGEMENT
 */
export async function createBill(billData: any) {
  try {
    const docRef = await addDoc(collection(db, BILLS_COLLECTION), {
      ...billData,
      ownerId: billData.ownerId || auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error creating bill: ", error);
    return { success: false, error: error.message || error };
  }
}

export async function getShopBills(shopId: string): Promise<any[]> {
  try {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) {
      console.error("Error getting shop bills: missing authenticated user");
      return [];
    }

    const q = query(
      collection(db, BILLS_COLLECTION),
      where("shopId", "==", shopId)
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs
      .map(standardizeData)
      .filter(Boolean);

    return results.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  } catch (error) {
    console.error("Error getting shop bills: ", error);
    return [];
  }
}

export async function updateBill(id: string, billData: any) {
  try {
    const docRef = doc(db, BILLS_COLLECTION, id);
    await updateDoc(docRef, {
      ...billData,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error updating bill: ", error);
    return { success: false, error: error.message || error };
  }
}

export async function finalizeBillWithTransaction(
  billId: string | null,
  billData: any,
  shopId: string,
  itemsToDeduct: any[]
) {
  try {
    const shopRef = doc(db, "shops", shopId);
    let finalBillId = billId;
    let finalMenu: any[] = [];

    await runTransaction(db, async (transaction) => {
      const shopSnap = await transaction.get(shopRef);
      if (!shopSnap.exists()) {
        throw new Error("Shop not found");
      }

      const shopDetails = shopSnap.data();
      const menu = JSON.parse(JSON.stringify(shopDetails.menu || []));

      // Validate and deduct stock
      for (const item of itemsToDeduct) {
        if (!item.name) continue;

        let found = false;
        for (const category of menu) {
          const catName = category.name || category.category || "";
          if (catName.toLowerCase().trim() === (item.category || "").toLowerCase().trim()) {
            const menuItem = (category.items || []).find(
              (i: any) => (i.name || "").toLowerCase().trim() === item.name.toLowerCase().trim()
            );

            if (menuItem) {
              found = true;
              if (
                menuItem.stock !== undefined &&
                menuItem.stock !== null &&
                (typeof menuItem.stock === "number" || typeof menuItem.stock === "string")
              ) {
                const currentStock = Number(menuItem.stock);
                if (!isNaN(currentStock)) {
                  if (currentStock < item.quantity) {
                    throw new Error(`Insufficient stock for "${item.name}". Available: ${currentStock}, Requested: ${item.quantity}`);
                  }
                  menuItem.stock = currentStock - item.quantity;
                }
              }
              break;
            }
          }
        }
      }

      const now = new Date();
      const serializedBillData = {
        ...billData,
        updatedAt: now.toISOString(),
      };

      if (finalBillId) {
        const billRef = doc(db, BILLS_COLLECTION, finalBillId);
        transaction.update(billRef, serializedBillData);
      } else {
        const billsCol = collection(db, BILLS_COLLECTION);
        const newBillRef = doc(billsCol);
        finalBillId = newBillRef.id;
        serializedBillData.id = finalBillId;
        serializedBillData.createdAt = now.toISOString();
        transaction.set(newBillRef, serializedBillData);
      }

      transaction.update(shopRef, {
        menu,
        updatedAt: serverTimestamp(),
      });

      finalMenu = menu;
    });

    return { success: true, billId: finalBillId, menu: finalMenu };
  } catch (error: any) {
    console.error("Error finalizing bill transaction:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteBill(id: string) {
  try {
    await deleteDoc(doc(db, BILLS_COLLECTION, id));
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting bill: ", error);
    return { success: false, error: error.message || error };
  }
}

/**
 * Master Data Retrieval (Categories, Clusters, Countries, States, Cities, Areas)
 */
export async function getCategories(): Promise<any[]> {
  try {
    const q = query(
      collection(db, "categories"),
      where("status", "==", "approved")
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(standardizeData).filter(Boolean);
    return results.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  } catch (error) {
    console.error("Error getting categories: ", error);
    return [];
  }
}

export async function proposeCategory(name: string) {
  try {
    const q = query(collection(db, "categories"), where("name", "==", name));
    const snap = await getDocs(q);
    if (!snap.empty) return { success: true, id: snap.docs[0].id };

    const docRef = await addDoc(collection(db, "categories"), {
      name,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    await logActivity(
      "CAT_PROPOSE",
      `Proposed new category: ${name}`,
      docRef.id,
      "category",
      "User"
    );
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error proposing category: ", error);
    return { success: false, error };
  }
}

export async function getClusters(): Promise<any[]> {
  try {
    const q = query(
      collection(db, "clusters"),
      where("status", "==", "approved")
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(standardizeData).filter(Boolean);
    return results.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
  } catch (error) {
    console.error("Error getting clusters: ", error);
    return [];
  }
}

export async function proposeCluster(
  name: string,
  category: string,
  area = "",
  city = "",
  pincode = "",
  lat: number | null = null,
  lng: number | null = null
) {
  try {
    const q = query(
      collection(db, "clusters"),
      where("name", "==", name),
      where("category", "==", category),
      where("area", "==", area),
      where("city", "==", city),
      where("pincode", "==", pincode)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return { success: true, id: snap.docs[0].id };

    const docRef = await addDoc(collection(db, "clusters"), {
      name,
      category,
      area,
      city,
      pincode,
      lat,
      lng,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    await logActivity(
      "CLUSTER_PROPOSE",
      `Proposed new cluster: ${name} for ${category} in ${area}, ${city}`,
      docRef.id,
      "cluster",
      "User"
    );
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error proposing cluster: ", error);
    return { success: false, error };
  }
}

export async function getCountries(): Promise<any[]> {
  try {
    const q = query(collection(db, "countries"));
    const snap = await getDocs(q);
    return snap.docs.map(standardizeData).filter(Boolean);
  } catch (error) {
    console.error("Error getting countries:", error);
    return [];
  }
}

export async function getStates(): Promise<any[]> {
  try {
    const q = query(collection(db, "states"));
    const snap = await getDocs(q);
    return snap.docs.map(standardizeData).filter(Boolean);
  } catch (error) {
    console.error("Error getting states:", error);
    return [];
  }
}

export async function getCities(): Promise<any[]> {
  try {
    const q = query(collection(db, "cities"));
    const snap = await getDocs(q);
    return snap.docs.map(standardizeData).filter(Boolean);
  } catch (error) {
    console.error("Error getting cities:", error);
    return [];
  }
}

export async function getAreas(): Promise<any[]> {
  try {
    const q = query(collection(db, "areas"));
    const snap = await getDocs(q);
    return snap.docs.map(standardizeData).filter(Boolean);
  } catch (error) {
    console.error("Error getting areas:", error);
    return [];
  }
}

/**
 * Checks if a shop slug is available. Excludes the current shop ID when editing.
 */
export async function isSlugAvailable(slug: string, currentShopId?: string | null): Promise<boolean> {
  if (!slug || slug.trim() === "") return false;
  try {
    const cleanSlug = slug.trim().toLowerCase();
    const q = query(
      collection(db, COLLECTION_NAME),
      where("slug", "==", cleanSlug)
    );
    const snap = await getDocs(q);
    const activeMatches = snap.docs.filter((doc) => {
      const data = doc.data();
      return data.status !== "deleted" && data.isDeleted !== true;
    });
    if (activeMatches.length === 0) return true;
    if (currentShopId) {
      const otherMatches = activeMatches.filter((doc) => doc.id !== currentShopId);
      return otherMatches.length === 0;
    }
    return false;
  } catch (error) {
    console.error("Error checking slug availability: ", error);
    return false;
  }
}

/**
 * Saves a payment transaction to Firestore.
 */
export async function createPaymentRecord(paymentData: any) {
  try {
    const docRef = await addDoc(collection(db, "payments"), {
      ...paymentData,
      createdAt: serverTimestamp(),
    });
    // Log the activity
    await logActivity(
      "PAYMENT",
      `Feature "${paymentData.featureKey}" activated via ${paymentData.paymentMethod} (Txn: ${paymentData.transactionId}).`,
      paymentData.shopId,
      "shop",
      auth.currentUser?.email || "Merchant"
    );
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error creating payment record: ", error);
    return { success: false, error: error.message || error };
  }
}

/**
 * Gets payment transactions for a shop.
 */
export async function getShopPayments(shopId: string): Promise<any[]> {
  try {
    const q = query(
      collection(db, "payments"),
      where("shopId", "==", shopId)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map(standardizeData).filter(Boolean);
    return results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  } catch (error) {
    console.error("Error getting shop payments: ", error);
    return [];
  }
}

/**
 * ─── STAFF MANAGEMENT ───────────────────────────────────────────────
 */

export async function getStaff(shopId: string): Promise<any[]> {
  try {
    const q = collection(db, "shops", shopId, "staff");
    const snap = await getDocs(q);
    const staff = snap.docs.map(standardizeData).filter(Boolean);
    return staff.sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  } catch (error) {
    console.error("Error getting staff: ", error);
    return [];
  }
}

export async function addStaff(shopId: string, staffData: any) {
  try {
    const docRef = await addDoc(collection(db, "shops", shopId, "staff"), {
      ...staffData,
      createdAt: new Date().toISOString(),
    });
    await logActivity(
      "STAFF_CREATE",
      `Added staff member "${staffData.name}".`,
      shopId,
      "shop"
    );
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error adding staff: ", error);
    return { success: false, error: error.message };
  }
}

export async function updateStaff(shopId: string, staffId: string, staffData: any) {
  try {
    const docRef = doc(db, "shops", shopId, "staff", staffId);
    await updateDoc(docRef, {
      ...staffData,
      updatedAt: new Date().toISOString(),
    });
    await logActivity(
      "STAFF_UPDATE",
      `Updated staff member "${staffData.name || staffId}".`,
      shopId,
      "shop"
    );
    return { success: true };
  } catch (error: any) {
    console.error("Error updating staff: ", error);
    return { success: false, error: error.message };
  }
}

export async function deleteStaff(shopId: string, staffId: string) {
  try {
    const docRef = doc(db, "shops", shopId, "staff", staffId);
    await deleteDoc(docRef);
    await logActivity(
      "STAFF_DELETE",
      `Removed staff member ID "${staffId}".`,
      shopId,
      "shop"
    );
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting staff: ", error);
    return { success: false, error: error.message };
  }
}

/**
 * ─── CUSTOMER CRM MANAGEMENT ────────────────────────────────────────
 */

export async function getCustomers(shopId: string): Promise<any[]> {
  try {
    const q = query(collection(db, "shops", shopId, "customers"), orderBy("name", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(standardizeData).filter(Boolean);
  } catch (error) {
    console.error("Error getting customers: ", error);
    return [];
  }
}

export async function getCustomerByPhone(shopId: string, phone: string): Promise<any | null> {
  try {
    const q = query(
      collection(db, "shops", shopId, "customers"),
      where("phone", "==", phone),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return standardizeData(snap.docs[0]);
  } catch (error) {
    console.error("Error finding customer by phone: ", error);
    return null;
  }
}

export async function addCustomer(shopId: string, customerData: any) {
  try {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const customerId = `SB-CUST-${randomSuffix}`;
    const docRef = await addDoc(collection(db, "shops", shopId, "customers"), {
      ...customerData,
      customerId,
      stats: customerData.stats || { totalAppointments: 0, totalSpend: 0 },
      createdAt: new Date().toISOString(),
    });
    return { success: true, id: docRef.id, customerId };
  } catch (error: any) {
    console.error("Error adding customer: ", error);
    return { success: false, error: error.message };
  }
}

export async function updateCustomer(shopId: string, docId: string, customerData: any) {
  try {
    const docRef = doc(db, "shops", shopId, "customers", docId);
    await updateDoc(docRef, {
      ...customerData,
      updatedAt: new Date().toISOString(),
    });
    return { success: true };
  } catch (error: any) {
    console.error("Error updating customer: ", error);
    return { success: false, error: error.message };
  }
}

export async function upsertCustomerFromBooking(
  shopId: string,
  bookingData: { name: string; phone: string; email?: string; bookingPrice?: number }
): Promise<string> {
  try {
    const existing = await getCustomerByPhone(shopId, bookingData.phone);
    const price = Number(bookingData.bookingPrice) || 0;
    const todayStr = new Date().toISOString().split("T")[0];

    if (existing) {
      const docRef = doc(db, "shops", shopId, "customers", existing.id);
      const currentStats = existing.stats || { totalAppointments: 0, totalSpend: 0 };
      const updatedStats = {
        totalAppointments: (currentStats.totalAppointments || 0) + 1,
        totalSpend: (currentStats.totalSpend || 0) + price,
        lastBookingDate: todayStr,
      };

      await updateDoc(docRef, {
        name: bookingData.name.trim(), // Keep name updated
        email: (bookingData.email || existing.email || "").trim(),
        stats: updatedStats,
        updatedAt: new Date().toISOString(),
      });
      return existing.customerId;
    } else {
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const customerId = `SB-CUST-${randomSuffix}`;
      
      await addDoc(collection(db, "shops", shopId, "customers"), {
        customerId,
        name: bookingData.name.trim(),
        phone: bookingData.phone.trim(),
        email: (bookingData.email || "").trim(),
        stats: {
          totalAppointments: 1,
          totalSpend: price,
          lastBookingDate: todayStr,
        },
        createdAt: new Date().toISOString(),
      });
      return customerId;
    }
  } catch (error) {
    console.error("Error upserting customer: ", error);
    return "";
  }
}






