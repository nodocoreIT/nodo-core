import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { imageUrl, productId } = await req.json()

  if (!imageUrl || !productId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  const apiKey = process.env.REMOVE_BG_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'REMOVE_BG_API_KEY not configured' }, { status: 500 })
  }

  // Call remove.bg with the image URL
  const formData = new FormData()
  formData.append('image_url', imageUrl)
  formData.append('size', 'auto')

  const bgRes = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey },
    body: formData,
  })

  if (!bgRes.ok) {
    const err = await bgRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: err?.errors?.[0]?.title || `remove.bg error ${bgRes.status}` },
      { status: bgRes.status }
    )
  }

  const imageBuffer = Buffer.from(await bgRes.arrayBuffer())

  // Upload result to Supabase Storage
  const supabase = await createClient()
  const fileName = `productos/${productId}-nobg-${Date.now()}.png`

  const { error: uploadError } = await supabase.storage
    .from('productos')
    .upload(fileName, imageBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('productos')
    .getPublicUrl(fileName)

  // Update product imagen_url
  const { error: updateError } = await supabase
    .from('productos')
    .update({ imagen_url: publicUrl })
    .eq('id', productId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ publicUrl })
}
