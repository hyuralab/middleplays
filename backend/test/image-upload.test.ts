/// <reference types="node" />
import { createReadStream, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * Test image upload functionality
 */

// Create a simple test image (1x1 red pixel PNG)
const redPixelPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xdd, 0x8d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
])

async function testImageUpload() {
  const { uploadImage, isValidImage, getImageMetadata } = await import('@/libs/image-upload')

  console.log('Testing image upload functionality...\n')

  // Test 1: Validate image
  console.log('✓ Test 1: Validating test image...')
  const isValid = await isValidImage(redPixelPng)
  if (!isValid) {
    console.error('❌ Image validation failed')
    process.exit(1)
  }
  console.log('✓ Image is valid\n')

  // Test 2: Get metadata
  console.log('✓ Test 2: Getting image metadata...')
  const metadata = await getImageMetadata(redPixelPng)
  console.log(`  Width: ${metadata.width}`)
  console.log(`  Height: ${metadata.height}`)
  console.log(`  Format: ${metadata.format}`)
  console.log(`  Size: ${metadata.size} bytes\n`)

  // Test 3: Upload image
  console.log('✓ Test 3: Uploading image...')
  const uploadedUrl = await uploadImage(redPixelPng, 'test-image.png')
  console.log(`  Uploaded to: ${uploadedUrl}\n`)

  if (!uploadedUrl.includes('.webp')) {
    console.error('❌ Uploaded image is not in WebP format')
    process.exit(1)
  }

  console.log('✅ All image upload tests passed!')
}

testImageUpload().catch((error) => {
  console.error('Test failed:', error)
  process.exit(1)
})
