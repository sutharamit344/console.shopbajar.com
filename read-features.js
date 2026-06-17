import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, orderBy } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBREwx-qtUwIOT_cBvmyFm1v13gvQrF-QM",
  authDomain: "shop-7a83a.firebaseapp.com",
  projectId: "shop-7a83a",
  storageBucket: "shop-7a83a.firebasestorage.app",
  messagingSenderId: "656337522882",
  appId: "1:656337522882:web:f6663390833d4c80b0eb5b",
  databaseURL: "https://shop-7a83a-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const q = collection(db, "features");
    const snap = await getDocs(q);
    console.log("Features Count:", snap.size);
    const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Features:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error fetching features:", error);
  }
}

run();
