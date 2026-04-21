export interface ImgBBUploadResponse {
  data: {
    id: string
    title: string
    url_viewer: string
    url: string
    display_url: string
    width: number
    height: number
    size: number
    time: number
    expiration: number
    image: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    thumb: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    medium?: {
      filename: string
      name: string
      mime: string
      extension: string
      url: string
    }
    delete_url: string
  }
  success: boolean
  status: number
}

export interface ImgBBUploadedImage {
  id: string
  url: string
  displayUrl: string
  thumbUrl: string
  deleteUrl: string
  width: number
  height: number
  size: number
}

export async function uploadImageToImgBB(
  dataUrl: string,
  apiKey: string,
  name?: string,
  expiration?: number
): Promise<ImgBBUploadedImage> {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('imgBB API key is required. Please configure it in Settings.')
  }

  const base64Data = dataUrl.split(',')[1]
  if (!base64Data) {
    throw new Error('Invalid image data URL')
  }

  const formData = new FormData()
  formData.append('image', base64Data)
  if (name) {
    formData.append('name', name)
  }

  // Build URL with key parameter and optional expiration (in seconds, 60-15552000)
  let url = `https://api.imgbb.com/1/upload?key=${apiKey}`
  if (expiration !== undefined && expiration >= 60 && expiration <= 15552000) {
    url += `&expiration=${expiration}`
  }

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`imgBB upload failed: ${response.status} ${errorText}`)
  }

  const result: ImgBBUploadResponse = await response.json()

  if (!result.success) {
    throw new Error('imgBB upload was not successful')
  }

  return {
    id: result.data.id,
    url: result.data.url,
    displayUrl: result.data.display_url,
    thumbUrl: result.data.thumb.url,
    deleteUrl: result.data.delete_url,
    width: result.data.width,
    height: result.data.height,
    size: result.data.size,
  }
}

export async function uploadMultipleImagesToImgBB(
  dataUrls: string[],
  apiKey: string,
  namePrefix?: string,
  expiration?: number
): Promise<ImgBBUploadedImage[]> {
  const uploadPromises = dataUrls.map((dataUrl, index) => {
    const name = namePrefix ? `${namePrefix}-${index + 1}` : undefined
    return uploadImageToImgBB(dataUrl, apiKey, name, expiration)
  })

  return Promise.all(uploadPromises)
}
