import sharp from 'sharp'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'
import { logger } from './logger'

// Configuration
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'images')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const QUALITY = 75 // WebP quality (0-100), balanced for quality vs file size
const MAX_WIDTH = 1920 // Max image width
const MAX_HEIGHT = 1920 // Max image height

/**
 * Generate unique filename for image
 */
function generateFilename(originalName: string): string {
  const timestamp = Date.now()
  const randomString = randomBytes(8).toString('hex')
  return `img_${timestamp}_${randomString}.webp`
}

/**
 * Validate image before processing
 */
function validateImageBuffer(buffer: Buffer): void {
  if (!buffer || buffer.length === 0) {
    throw new Error('Image buffer is empty')
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`Image size exceeds maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }
}

/**
 * Upload image: convert to WebP, compress, and save
 * @param buffer - Image file buffer
 * @param originalName - Original filename (for reference)
 * @returns Public URL of uploaded image
 */
export async function uploadImage(buffer: Buffer, originalName: string = 'image'): Promise<string> {
  try {
    validateImageBuffer(buffer)

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
      logger.info(`Created upload directory: ${UPLOAD_DIR}`)
    }

    // Generate unique filename
    const filename = generateFilename(originalName)
    const filepath = join(UPLOAD_DIR, filename)

    // Process image: convert to WebP, resize if needed, compress
    const processedImage = await sharp(buffer)
      .resize(MAX_WIDTH, MAX_HEIGHT, {
        fit: 'inside', // Maintain aspect ratio, don't upscale
        withoutEnlargement: true,
      })
      .webp({ quality: QUALITY })
      .toBuffer()

    logger.info(`Image processed: ${originalName} → ${filename} (${buffer.length} → ${processedImage.length} bytes)`)

    // Save to disk
    await writeFile(filepath, processedImage)

    // Return public URL
    const publicUrl = `/uploads/images/${filename}`
    logger.info(`Image uploaded successfully: ${publicUrl}`)

    return publicUrl
  } catch (error) {
    logger.error('Image upload failed', error)
    throw error instanceof Error ? error : new Error('Image upload failed')
  }
}

/**
 * Process multiple images (for bulk operations)
 */
export async function uploadImages(buffers: (Buffer | undefined)[], names: string[] = []): Promise<(string | null)[]> {
  const urls: (string | null)[] = []

  for (let i = 0; i < buffers.length; i++) {
    if (!buffers[i]) {
      urls.push(null)
      continue
    }

    try {
      const url = await uploadImage(buffers[i]!, names[i] || `image_${i}`)
      urls.push(url)
    } catch (error) {
      logger.error(`Failed to upload image ${i}`, error)
      // Continue with next image instead of failing completely
      urls.push(null) // Null for failed upload
    }
  }

  return urls
}

/**
 * Delete image from storage
 * @param publicUrl - Public URL returned from uploadImage
 */
export async function deleteImage(publicUrl: string): Promise<void> {
  try {
    // Extract filename from URL
    const filename = publicUrl.split('/').pop()
    if (!filename) {
      throw new Error('Invalid image URL')
    }

    const filepath = join(UPLOAD_DIR, filename)

    // Check if file exists before attempting deletion
    if (existsSync(filepath)) {
      await unlink(filepath)
      logger.info(`Image deleted: ${filename}`)
    } else {
      logger.warn(`Image file not found for deletion: ${filename}`)
    }
  } catch (error) {
    logger.error('Image deletion failed', error)
    // Don't throw - deletion failure shouldn't break the flow
  }
}

/**
 * Validate if buffer is a valid image
 */
export async function isValidImage(buffer: Buffer): Promise<boolean> {
  try {
    const metadata = await sharp(buffer).metadata()
    return metadata.format !== undefined && ['jpeg', 'png', 'webp', 'gif', 'tiff'].includes(metadata.format)
  } catch (error) {
    return false
  }
}

/**
 * Get image metadata without processing
 */
export async function getImageMetadata(buffer: Buffer) {
  try {
    const metadata = await sharp(buffer).metadata()
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: buffer.length,
      space: metadata.space,
      hasAlpha: metadata.hasAlpha,
    }
  } catch (error) {
    logger.error('Failed to get image metadata', error)
    throw error
  }
}
