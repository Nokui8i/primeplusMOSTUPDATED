import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, getDownloadURL, FirebaseStorage } from 'firebase/storage';
import { app, storage } from '@/lib/firebase/config';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, User-Agent, x-goog-resumable');
    res.setHeader('Access-Control-Max-Age', '3600');
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { path } = req.query;
    if (!path) {
      res.status(400).json({ error: 'Path is required' });
      return;
    }

    const fullPath = Array.isArray(path) ? path.join('/') : path;
    console.log('Fetching image from path:', fullPath);

    // Check if Firebase app is initialized
    if (!app) {
      console.error('Firebase app is not initialized');
      res.status(500).json({ error: 'Firebase not initialized' });
      return;
    }

    // Check if storage is initialized
    if (!storage) {
      console.error('Firebase Storage is not initialized');
      res.status(500).json({ error: 'Storage not initialized' });
      return;
    }

    // Get the Firebase Storage instance
    const storageRef = ref(storage as FirebaseStorage, fullPath);
    console.log('Storage reference created:', storageRef.fullPath);

    try {
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      console.log('Got download URL:', downloadURL);

      // Fetch the image
      const response = await fetch(downloadURL, {
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });
      console.log('Fetch response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      console.log('Image buffer size:', buffer.byteLength);

      // Set appropriate headers
      res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, User-Agent, x-goog-resumable');
      res.setHeader('Access-Control-Max-Age', '3600');

      // Send the image data
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Error fetching image:', error);
      
      // Try alternative paths
      const pathParts = fullPath.split('/');
      const userId = pathParts[2]; // Assuming path format: content/images/userId/filename
      const fileName = pathParts[pathParts.length - 1];
      
      console.log('Trying alternative paths for userId:', userId, 'fileName:', fileName);
      
      const alternativePaths = [
        `content/images/${userId}/${fileName}`,
        `content/${userId}/media/${fileName}`,
        `users/${userId}/profile/${fileName}`
      ];

      for (const altPath of alternativePaths) {
        try {
          console.log('Trying path:', altPath);
          const altRef = ref(storage as FirebaseStorage, altPath);
          const downloadURL = await getDownloadURL(altRef);
          const response = await fetch(downloadURL, {
            headers: {
              'Origin': 'http://localhost:3000'
            }
          });
          
          if (!response.ok) {
            console.log('Path failed:', altPath, 'Status:', response.status);
            continue;
          }

          const buffer = await response.arrayBuffer();
          console.log('Found image at path:', altPath, 'Size:', buffer.byteLength);

          res.setHeader('Content-Type', response.headers.get('content-type') || 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=31536000');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, User-Agent, x-goog-resumable');
          res.setHeader('Access-Control-Max-Age', '3600');

          res.send(Buffer.from(buffer));
          return;
        } catch (error) {
          console.error(`Error trying alternative path ${altPath}:`, error);
          continue;
        }
      }

      // If all paths fail, return 404
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
} 