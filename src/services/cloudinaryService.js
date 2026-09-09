let cloudinary;

const getCloudinary = () => {
  if (cloudinary) return cloudinary;

  try {
    cloudinary = require('cloudinary').v2;
    return cloudinary;
  } catch (error) {
    throw new Error('Cloudinary SDK is not installed. Run npm install in the backend folder.');
  }
};

const ensureCloudinaryConfig = () => {
  if (!process.env.CLOUDINARY_URL) {
    throw new Error('Cloudinary is not configured. Add CLOUDINARY_URL to backend/.env.');
  }

  getCloudinary().config({ secure: true });
};

const uploadBuffer = (buffer, { resourceType, folder, publicId } = {}) => new Promise((resolve, reject) => {
  ensureCloudinaryConfig();
  const client = getCloudinary();

  const upload = client.uploader.upload_stream(
    {
      resource_type: resourceType || 'auto',
      folder: folder || 'ochi-live/uploads',
      public_id: publicId,
      use_filename: false,
      unique_filename: true,
      overwrite: false,
    },
    (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    },
  );

  upload.end(buffer);
});

const getVideoThumbnailUrl = (publicId) => {
  ensureCloudinaryConfig();
  return getCloudinary().url(publicId, {
    resource_type: 'video',
    secure: true,
    format: 'jpg',
    transformation: [
      { width: 720, height: 405, crop: 'fill', gravity: 'auto' },
    ],
  });
};

module.exports = {
  uploadBuffer,
  getVideoThumbnailUrl,
};
