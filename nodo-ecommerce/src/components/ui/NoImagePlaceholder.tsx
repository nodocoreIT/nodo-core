'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface Props {
  width: number
  height: number
  fill?: boolean
  sizes?: string
  className?: string
}

export default function NoImagePlaceholder({ width, height, fill, sizes, className }: Props) {
  const [src, setSrc] = useState('/imagen_no_disponible_dark.png')

  useEffect(() => {
    const update = () => {
      const theme = document.documentElement.getAttribute('data-theme')
      setSrc(theme === 'light' ? '/imagen_no_disponible_light.png' : '/imagen_no_disponible_dark.png')
    }
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  if (fill) {
    return <Image src={src} alt="Imagen no disponible" fill sizes={sizes} className={className} />
  }

  return <Image src={src} alt="Imagen no disponible" width={width} height={height} className={className} />
}
