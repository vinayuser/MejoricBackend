const admin = require('firebase-admin');
const fs = require("fs");
const path = require("path");
// const serviceAccount = require('../firebaseServiceKeys.json');
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
// Since we may not have the service account key uploaded yet,
// we will instantiate it via standard env variables or ignore init if credentials don't exist yet, 
// to prevent the app from crashing on start if not configured.

console.log("onrender path", fs.existsSync("/etc/secrets/firebaseServiceKeys.json")); // onrender
console.log("local path", fs.existsSync(path.join(__dirname, process.env.FIREBASE_SERVICE_ACCOUNT_PATH))); // local

let isFirebaseInitialized = false;

try {
    // Attempting to init using default application credentials (e.g. from FIREBASE_CONFIG env)
    // or by passing a specific JSON file path if specified in an env.

    // For local dev, a common pattern is checking for GOOGLE_APPLICATION_CREDENTIALS
    // Alternatively, you can use a serviceAccountKey.json path.
    if (!admin.apps.length) {
        // Option A: If a path to service account json is in environment variables (e.g. FIREBASE_SERVICE_ACCOUNT_PATH)
        if (serviceAccountPath) {
            const serviceAccount = require(serviceAccountPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            isFirebaseInitialized = true;
        } else {
            // Option B: Attempt default init (relies on GOOGLE_APPLICATION_CREDENTIALS)
            admin.initializeApp();
            isFirebaseInitialized = true;
        }
    } else {
        isFirebaseInitialized = true; // Already initialized
    }
} catch (error) {
    console.error('Firebase Admin SDK Initialization Error: ', error.message);
    console.log('Push notifications might not work. Please ensure FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS is set properly in .env.');
}

module.exports = { admin, isFirebaseInitialized };
