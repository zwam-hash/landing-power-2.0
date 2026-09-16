import { initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyBRxbS7IFbQpq0tWNwjwCp-0NxYXTbY1Mc',
  authDomain: 'zwam-bi.firebaseapp.com',
  projectId: 'zwam-bi',
  storageBucket: 'zwam-bi.firebasestorage.app',
  messagingSenderId: '458988705869',
  appId: '1:458988705869:web:cff1d717338fb7ce196404',
};

export const firebaseApp = initializeApp(firebaseConfig);
