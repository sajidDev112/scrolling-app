#!/usr/bin/env node
/**
 * Migration script: Upload existing experiences from data.json + src/assets to Firebase
 * Usage: node migrate-to-firebase.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Firebase config (same as in src/firebase/firebase.ts)
const firebaseConfig = {
  apiKey: 'AIzaSyCf9Esb-XGG_SjBgCpVwyFVDPvG_2bi-ic',
  authDomain: 'scrolling-app-806c7.firebaseapp.com',
  projectId: 'scrolling-app-806c7',
  storageBucket: 'scrolling-app-806c7.firebasestorage.app',
  messagingSenderId: '95028110710',
  appId: '1:95028110710:web:361ab97a05112f3ae28657',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const storiesCollection = collection(db, 'stories');

// ── Upload image file to Firebase Storage ──
async function uploadImageFile(localPath, storyId) {
  try {
    // Resolve the correct file path
    let filePath = localPath;
    
    // If path starts with /src/assets or src/assets, try the src/assets directory
    if (localPath.includes('src/assets')) {
      filePath = path.join(__dirname, 'src/assets', path.basename(localPath));
    } else if (localPath.startsWith('/')) {
      // Try stripping leading slash and looking in src/assets
      filePath = path.join(__dirname, 'src/assets', path.basename(localPath));
    }

    if (!fs.existsSync(filePath)) {
      console.warn(`   ⚠️  File not found: ${filePath}`);
      return null;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const storagePath = `story-images/${storyId}/${fileName}`;
    const imageRef = ref(storage, storagePath);

    console.log(`   ↳ Uploading: ${fileName}`);
    const snapshot = await uploadBytes(imageRef, fileBuffer);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error(`   ✗ Upload failed: ${error.message}`);
    return null;
  }
}

// ── Convert local image paths to Firebase URLs ──
async function migrateStory(story) {
  console.log(`\n📖 Migrating: ${story.title}`);

  const migratedStory = JSON.parse(JSON.stringify(story));

  // Upload and replace coverImage
  if (story.coverImage) {
    console.log('   Uploading cover image...');
    const coverURL = await uploadImageFile(story.coverImage, story.id);
    if (coverURL) {
      migratedStory.coverImage = coverURL;
    }
  }

  // Upload and replace story images
  if (Array.isArray(story.images) && story.images.length > 0) {
    console.log(`   Uploading ${story.images.length} story image(s)...`);
    const newImages = [];
    for (const imagePath of story.images) {
      const imageURL = await uploadImageFile(imagePath, story.id);
      if (imageURL) {
        newImages.push(imageURL);
      } else {
        newImages.push(imagePath); // Keep original if upload fails
      }
    }
    migratedStory.images = newImages;
  }

  // Save to Firestore
  try {
    console.log('   Saving to Firestore...');
    await setDoc(doc(storiesCollection, story.id), migratedStory);
    console.log('   ✓ Successfully migrated');
    return true;
  } catch (error) {
    console.error(`   ✗ Firestore save failed: ${error.message}`);
    return false;
  }
}

// ── Main migration function ──
async function migrateAll() {
  console.log('🚀 Starting Firebase Migration\n');
  console.log('Reading data.json...');

  const dataPath = path.join(__dirname, 'public', 'data.json');

  if (!fs.existsSync(dataPath)) {
    console.error('✗ data.json not found');
    process.exit(1);
  }

  let stories;
  try {
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    stories = JSON.parse(rawData);
  } catch (error) {
    console.error(`✗ Failed to parse data.json: ${error.message}`);
    process.exit(1);
  }

  if (!Array.isArray(stories)) {
    console.error('✗ data.json does not contain an array of stories');
    process.exit(1);
  }

  console.log(`Found ${stories.length} stories to migrate\n`);

  let successful = 0;
  for (const story of stories) {
    const result = await migrateStory(story);
    if (result) successful++;
  }

  console.log(`\n✅ Migration complete: ${successful}/${stories.length} stories migrated`);
  process.exit(0);
}

// Run migration
migrateAll().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
