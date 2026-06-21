import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDO47S0hhkQtdq8GOljAov9T_9K1lbZYVo",
  authDomain: "finance-app-c48a3.firebaseapp.com",
  projectId: "finance-app-c48a3",
  storageBucket: "finance-app-c48a3.firebasestorage.app",
  messagingSenderId: "606950715723",
  appId: "1:606950715723:web:a377c760fc1c1cba34b8ce"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
