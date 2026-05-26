import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { uuid } from '@/lib/utils';
import type { Story } from '@/lib/types';

const firebaseConfig = {
  apiKey: 'AIzaSyCf9Esb-XGG_SjBgCpVwyFVDPvG_2bi-ic',
  authDomain: 'scrolling-app-806c7.firebaseapp.com',
  projectId: 'scrolling-app-806c7',
  storageBucket: 'scrolling-app-806c7.firebasestorage.app',
  messagingSenderId: '95028110710',
  appId: '1:95028110710:web:361ab97a05112f3ae28657',
};

const app = initializeApp(firebaseConfig);
export const database = getFirestore(app);
export const storage = getStorage(app);

const storiesCollection = collection(database, 'stories');

export async function uploadImage(file: File, storyId?: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const fileName = `${Date.now()}-${uuid()}-${safeName}`;
  const storagePath = storyId ? `story-images/${storyId}/${fileName}` : `story-images/${fileName}`;
  const imageRef = ref(storage, storagePath);
  const snapshot = await uploadBytes(imageRef, file);
  return getDownloadURL(snapshot.ref);
}

export async function loadStories(): Promise<Story[]> {
  const snapshot = await getDocs(storiesCollection);
  return snapshot.docs
    .map((docSnap) => docSnap.data() as Story)
    .filter((story): story is Story => Boolean(story && story.id && story.slug));
}

export async function saveStory(story: Story): Promise<void> {
  await setDoc(doc(storiesCollection, story.id), story);
}

export async function deleteStoryImages(storyId: string): Promise<void> {
  const prefixRef = ref(storage, `story-images/${storyId}`);
  try {
    const listResult = await listAll(prefixRef);
    await Promise.all(listResult.items.map((itemRef) => deleteObject(itemRef)));
    await Promise.all(
      listResult.prefixes.map(async (subRef) => {
        const nested = await listAll(subRef);
        await Promise.all(nested.items.map((itemRef) => deleteObject(itemRef)));
      })
    );
  } catch (error) {
    console.error('Failed to delete story images from Storage:', error);
  }
}

export async function deleteStory(storyId: string): Promise<void> {
  await deleteStoryImages(storyId);
  await deleteDoc(doc(storiesCollection, storyId));
}
