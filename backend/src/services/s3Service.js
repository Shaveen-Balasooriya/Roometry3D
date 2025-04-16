import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';

// Get the directory path of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../..', '.env') });

// Create S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const bucketName = process.env.S3_BUCKET_NAME;

/**
 * Upload a file to S3
 * @param {string} fileName - Name to store the file as
 * @param {Buffer} fileContent - File content
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<Object>} Upload result with file URL
 */
export const uploadFile = async (fileName, fileContent, contentType) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
      ContentType: contentType
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    
    // Generate the URL to the uploaded file
    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    
    return {
      success: true,
      key: fileName,
      url: fileUrl
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Generate a signed URL for accessing a private S3 object
 * @param {string} fileName - Key of the file in S3
 * @param {number} expirySeconds - Seconds until URL expires
 * @returns {Promise<string>} Signed URL
 */
export const getSignedFileUrl = async (fileName, expirySeconds = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName
    });
    
    return await getSignedUrl(s3Client, command, { expiresIn: expirySeconds });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};
