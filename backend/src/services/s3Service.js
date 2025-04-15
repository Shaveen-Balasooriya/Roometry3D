import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand, 
  ListObjectsV2Command 
} from '@aws-sdk/client-s3';
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

// Log configuration but hide sensitive values
console.log('S3 Configuration:');
console.log('- Region:', process.env.AWS_REGION);
console.log('- Bucket:', process.env.S3_BUCKET_NAME);
console.log('- Access Key ID exists:', !!process.env.AWS_ACCESS_KEY_ID);
console.log('- Secret Access Key exists:', !!process.env.AWS_SECRET_ACCESS_KEY);

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
 * @param {Buffer|ReadableStream} fileContent - File content
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<Object>} Upload result with file URL
 */
export const uploadFile = async (fileName, fileContent, contentType) => {
  try {
    console.log(`Uploading file ${fileName} to bucket ${bucketName}`);
    
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
    console.log(`Generating signed URL for ${fileName}`);
    
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

/**
 * Delete a file from S3
 * @param {string} fileName - Key of the file in S3
 * @returns {Promise<Object>} Delete result
 */
export const deleteFile = async (fileName) => {
  try {
    console.log(`Deleting file ${fileName}`);
    
    const params = {
      Bucket: bucketName,
      Key: fileName
    };
    
    const command = new DeleteObjectCommand(params);
    await s3Client.send(command);
    
    return {
      success: true,
      message: `File ${fileName} deleted successfully`
    };
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * List files in a specific folder in the bucket
 * @param {string} prefix - Folder path (e.g., "models/")
 * @returns {Promise<Array>} List of files
 */
export const listFiles = async (prefix = '') => {
  try {
    console.log(`Listing files with prefix ${prefix}`);
    
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix
    });
    
    const response = await s3Client.send(command);
    
    return response.Contents?.map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      url: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${item.Key}`
    })) || [];
  } catch (error) {
    console.error('Error listing files from S3:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }
};

/**
 * Test the connection to S3
 * @returns {Promise<boolean>} Whether the connection is successful
 */
export const testS3Connection = async () => {
  try {
    console.log('Testing S3 connection...');
    
    // Try to list objects (limit to just 1) to test connection
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1
    });
    
    await s3Client.send(command);
    console.log('S3 connection successful');
    return true;
  } catch (error) {
    console.error('S3 connection failed:', error);
    return false;
  }
};
