'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface FaqItem {
  id: string
  pregunta: string
  respuesta: string
}

export default function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const open = openId === item.id
        return (
          <div
            key={item.id}
            className="bg-luxury-gray rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : item.id)}
              className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="text-white text-base font-medium">
                {item.pregunta}
              </span>
              <ChevronDown
                size={18}
                className={`text-gold shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
              />
            </button>

            {open && (
              <div className="px-6 pb-5 border-t border-luxury-gray-mid">
                <div
                  className="rich-content text-luxury-gray-light text-sm leading-relaxed pt-4"
                  dangerouslySetInnerHTML={{ __html: item.respuesta }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
