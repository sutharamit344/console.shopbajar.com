import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, setDoc, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBREwx-qtUwIOT_cBvmyFm1v13gvQrF-QM",
  authDomain: "shop-7a83a.firebaseapp.com",
  projectId: "shop-7a83a",
  storageBucket: "shop-7a83a.firebasestorage.app",
  messagingSenderId: "656337522882",
  appId: "1:656337522882:web:f6663390833d4c80b0eb5b",
  measurementId: "G-BMLSNM9M6D",
  databaseURL: "https://shop-7a83a-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const shopId = "R0UixUGETvMNExK7vOd7";
const transactionId = "pay_T1XyzDi3F3YbWC";

async function activateSubscription() {
  console.log("Starting activation process...");
  try {
    // 1. Update Shop paidFeatures
    const shopRef = doc(db, "shops", shopId);
    
    const qrOrderingFeature = {
      enabled: true,
      status: "active",
      billingCycle: "one-time",
      price: 19975,
      activatedAt: "2026-06-14T14:38:00.000Z",
      expiresAt: "2036-06-14T14:38:00.000Z"
    };

    // We merge it into the existing paidFeatures
    // Note: since updateDoc supports nested paths, we can set paidFeatures.qr_ordering directly
    await updateDoc(shopRef, {
      "paidFeatures.qr_ordering": qrOrderingFeature
    });
    console.log("Successfully updated shop paidFeatures for QR Table Ordering.");

    // 2. Add Payment record
    const paymentRef = doc(collection(db, "payments"));
    await setDoc(paymentRef, {
      shopId: shopId,
      featureKey: "qr_ordering",
      featureTitle: "QR Table Ordering",
      billingCycle: "one-time",
      subtotal: 19975,
      gstAmount: 3596,
      amountPaid: 23571,
      paymentMethod: "Razorpay Live",
      transactionId: transactionId,
      status: "completed",
      createdAt: "2026-06-14T14:38:00.000Z"
    });
    console.log("Successfully added payment record in Firestore.");
    console.log("Activation process completed successfully.");
  } catch (error) {
    console.error("Error during activation:", error);
  }
}

activateSubscription();
