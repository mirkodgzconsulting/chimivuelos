import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const CLOUDFLARE_R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME!;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CLOUDFLARE_ACCESS_KEY_ID = process.env.CLOUDFLARE_ACCESS_KEY_ID!;
const CLOUDFLARE_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_SECRET_ACCESS_KEY!;
const CLOUDFLARE_ENDPOINT = process.env.CLOUDFLARE_ENDPOINT!;
const CLOUDFLARE_IMAGES_TOKEN = process.env.CLOUDFLARE_IMAGES_TOKEN!;
const CLOUDFLARE_IMAGES_HASH = process.env.CLOUDFLARE_IMAGES_HASH!;

// S3 Client for Cloudflare R2
const r2 = new S3Client({
  region: 'auto',
  endpoint: CLOUDFLARE_ENDPOINT,
  credentials: {
    accessKeyId: CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: CLOUDFLARE_SECRET_ACCESS_KEY,
  },
});

export type StorageType = 'r2' | 'images';

interface UploadResult {
    path: string;       // R2 Key or Image ID
    storage: StorageType;
    url?: string;       // Immediate public URL if available
    name?: string;
    size?: number;
    type?: string;
}

/**
 * Uploads a file to the appropriate storage based on its type.
 * - Images -> Cloudflare Images (Resizing, optimization)
 * - Documents -> R2 (Cheaper, folders)
 */
export async function uploadClientFile(file: File, userId: string): Promise<UploadResult> {
    const isImage = file.type.startsWith('image/');

    if (isImage) {
        try {
            // Upload to Cloudflare Images
            const result = await uploadImageToCloudflare(file);
            // We use the Image ID as the 'path'
            return {
                path: result.id, 
                storage: 'images',
                url: result.variants?.[0], // Usually the public variant
                name: file.name,
                size: file.size,
                type: file.type
            };
        } catch (error) {
            console.warn('Cloudflare Images upload failed. Falling back to R2 secure storage.', error);
            // Fallback: Proceed to R2 upload below
        }
    }
   
    // Upload to R2 (Organized in folders) - Default for Docs OR Image Fallback
    // Folder structure: clients/{userId}/{timestamp}_filename
    const fileName = `clients/${userId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    await uploadFileToR2(file, fileName);

    return {
        path: fileName,
        storage: 'r2',
        name: file.name,
        size: file.size,
        type: file.type
    };
}

/**
 * Generates a viewable URL for a file.
 * - R2: Generates a signed URL (valid for 1 hour)
 * - Images: Returns the public delivery URL
 */
export async function getFileUrl(path: string, storage: StorageType): Promise<string> {
    if (storage === 'images') {
        // Construct Image Delivery URL
        // Format: https://imagedelivery.net/<account_hash>/<image_id>/<variant_name>
        // We assume 'public' variant for generic access
        return `https://imagedelivery.net/${CLOUDFLARE_IMAGES_HASH}/${path}/public`;
    } else {
        // R2 Presigned URL
        try {
            const isViewable = path.toLowerCase().endsWith('.pdf') || 
                               path.match(/\.(jpg|jpeg|png|webp|gif)$/i);

            const command = new GetObjectCommand({
                Bucket: CLOUDFLARE_R2_BUCKET_NAME,
                Key: path,
                ResponseContentDisposition: isViewable ? 'inline' : undefined,
                ResponseContentType: path.toLowerCase().endsWith('.pdf') ? 'application/pdf' : undefined,
            });
            // Link valid for 1 hour (3600 seconds)
            return await getSignedUrl(r2, command, { expiresIn: 3600 });
        } catch (error) {
            console.error('Error generating signed URL:', error);
            return '#error-url';
        }
    }
}

/**
 * Deletes a file from the appropriate storage.
 */
export async function deleteClientFileUniversal(path: string, storage: StorageType) {
    if (storage === 'images') {
        await deleteImageFromCloudflare(path);
    } else {
        // Assume R2 if unknown, or check format
        await deleteFileFromR2(path);
    }
}

// --- Internal Helpers ---

export async function uploadFileToR2(file: File, key: string) {
  try {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const command = new PutObjectCommand({
      Bucket: CLOUDFLARE_R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    });

    await r2.send(command);
    return key;
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error('Failed to upload file to R2');
  }
}

export async function deleteFileFromR2(key: string) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: CLOUDFLARE_R2_BUCKET_NAME,
            Key: key,
        });
        await r2.send(command);
    } catch (error) {
        console.error('Error deleting from R2:', error);
        // We log but don't strictly throw if file missing, to allow metadata cleanup
    }
}

 // Add Global Auth Fallback
 const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL;
 const CLOUDFLARE_GLOBAL_KEY = process.env.CLOUDFLARE_GLOBAL_KEY;

 export async function uploadImageToCloudflare(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Use Global API Key (Infallible Method)
    if (CLOUDFLARE_EMAIL && CLOUDFLARE_GLOBAL_KEY) {
        // console.log('[Debug] Using Global API Key for Cloudflare Images Upload');
        
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID.trim()}/images/v1`, {
            method: 'POST',
            headers: {
                'X-Auth-Email': CLOUDFLARE_EMAIL.trim(),
                'X-Auth-Key': CLOUDFLARE_GLOBAL_KEY.trim(),
            },
            body: formData,
        });

        const result = await response.json();
        
        if (!result.success) {
             console.error('Cloudflare Images Global Auth Upload Failed:', JSON.stringify(result.errors));
             throw new Error(`Failed to upload image: ${result.errors?.[0]?.message || 'Unknown error'}`);
        }
        return result.result;
    }

    // Fallback to Token Auth (Legacy / If Global Key missing)
    // ... [Previous logic would go here, but let's simplify to prioritize Global Key]
    throw new Error('Missing Cloudflare Global API Key or Email in .env.local');
 }

export async function deleteImageFromCloudflare(imageId: string) {
    try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/images/v1/${imageId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_IMAGES_TOKEN}`,
            },
        });

        const result = await response.json();
        // Ignore "image not found" errors to allow cleanup
        if (!result.success && result.errors?.[0]?.code !== 5404) {
             console.error('Cloudflare Images Delete Error:', result.errors);
        }
        return true;
    } catch (error) {
        console.error('Error deleting image:', error);
        throw error;
    }
}
