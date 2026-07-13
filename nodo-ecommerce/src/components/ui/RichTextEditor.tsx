'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TextStyle, FontSize, FontFamily } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link as LinkIcon, Highlighter,
  Heading1, Heading2, Heading3, Minus, Undo, Redo,
  ImageIcon, Loader2,
} from 'lucide-react'
import { useState } from 'react'

const FONTS = [
  { label: 'Sans-serif', value: 'sans-serif' },
  { label: 'Serif',      value: 'Georgia, serif' },
  { label: 'Mono',       value: 'monospace' },
  { label: 'Arial',      value: 'Arial, sans-serif' },
  { label: 'Verdana',    value: 'Verdana, sans-serif' },
]

const SIZES = ['10px','12px','14px','16px','18px','20px','24px','28px','32px','36px','48px','64px']

const COLORS = [
  '#ffffff','#D4AF37','#cccccc','#888888','#555555','#222222','#000000',
  '#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899',
]

interface ToolbarButtonProps {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
  disabled?: boolean
}

function Btn({ onClick, active, title, children, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-gold text-black'
          : 'text-luxury-gray-light hover:text-white hover:bg-luxury-gray-mid'
      } disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <span className="w-px h-5 bg-luxury-gray-mid self-center mx-0.5" />
}

async function uploadImageToStorage(file: File): Promise<string | null> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `content/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('branding')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) return null

  const { data } = supabase.storage.from('branding').getPublicUrl(path)
  return data.publicUrl
}

interface Props {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
}

export default function RichTextEditor({ value, onChange, placeholder = 'Escribí acá...', minHeight = '200px' }: Props) {
  const isInternalUpdate = useRef(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const insertImage = useCallback(async (file: File, editorInstance: ReturnType<typeof useEditor>) => {
    if (!editorInstance) return
    setUploadingImage(true)
    const url = await uploadImageToStorage(file)
    setUploadingImage(false)
    if (url) {
      editorInstance.chain().focus().setImage({ src: url }).run()
    }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontSize,
      FontFamily,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false, allowBase64: false }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'outline-none',
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (file) {
              // Get editor instance from view
              const editorInstance = (view as unknown as { editorView?: unknown } & { editor?: ReturnType<typeof useEditor> }).editor
              insertImage(file, editorInstance as ReturnType<typeof useEditor>)
            }
            return true
          }
        }
        return false
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files
        if (!files?.length) return false
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            const editorInstance = (view as unknown as { editor?: ReturnType<typeof useEditor> }).editor
            insertImage(file, editorInstance as ReturnType<typeof useEditor>)
            return true
          }
        }
        return false
      },
    },
    onUpdate({ editor }) {
      isInternalUpdate.current = true
      onChange(editor.getHTML())
    },
  })

  // Expose editor on the ProseMirror view for paste/drop handlers
  useEffect(() => {
    if (!editor) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(editor.view as any).editor = editor
  }, [editor])

  useEffect(() => {
    if (!editor) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [value, editor])

  if (!editor) return null

  function addLink() {
    const url = window.prompt('URL del enlace:')
    if (url) editor?.chain().focus().setLink({ href: url }).run()
  }

  async function handleImageButton() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (file) await insertImage(file, editor)
    }
    input.click()
  }

  const attrs = editor.getAttributes('textStyle')
  const currentFontFamily = attrs.fontFamily ?? ''
  const currentFontSize   = attrs.fontSize   ?? ''
  const currentColor      = attrs.color      ?? '#ffffff'

  return (
    <div className="border border-luxury-gray-mid focus-within:border-gold transition-colors">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-luxury-gray-mid bg-luxury-gray">

        <select
          value={currentFontFamily}
          onChange={(e) => {
            e.target.value
              ? editor.chain().focus().setFontFamily(e.target.value).run()
              : editor.chain().focus().unsetFontFamily().run()
          }}
          className="text-xs bg-[#111] text-luxury-gray-light border border-luxury-gray-mid px-1.5 py-1 focus:outline-none focus:border-gold h-7 max-w-[100px]"
        >
          <option value="">Fuente</option>
          {FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>

        <select
          value={currentFontSize}
          onChange={(e) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const chain = editor.chain().focus() as any
            e.target.value ? chain.setFontSize(e.target.value).run() : chain.unsetFontSize().run()
          }}
          className="text-xs bg-[#111] text-luxury-gray-light border border-luxury-gray-mid px-1.5 py-1 focus:outline-none focus:border-gold h-7 w-20"
        >
          <option value="">Tamaño</option>
          {SIZES.map((s) => <option key={s} value={s}>{s.replace('px', '')}</option>)}
        </select>

        <Sep />

        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Título 1"><Heading1 size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Título 2"><Heading2 size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Título 3"><Heading3 size={14} /></Btn>

        <Sep />

        <Btn onClick={() => editor.chain().focus().toggleBold().run()}      active={editor.isActive('bold')}      title="Negrita"><Bold size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()}    active={editor.isActive('italic')}    title="Cursiva"><Italic size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Subrayado"><UnderlineIcon size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()}    active={editor.isActive('strike')}    title="Tachado"><Strikethrough size={14} /></Btn>

        <Sep />

        <div className="flex items-center gap-1" title="Color de texto">
          <span className="text-[10px] text-luxury-gray-light font-bold select-none">A</span>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="w-5 h-5 cursor-pointer bg-transparent border-0 p-0"
          />
        </div>

        <Btn onClick={() => editor.chain().focus().toggleHighlight({ color: '#D4AF37' }).run()} active={editor.isActive('highlight')} title="Resaltar"><Highlighter size={14} /></Btn>

        <Sep />

        <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()}    active={editor.isActive({ textAlign: 'left' })}    title="Izquierda"><AlignLeft size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()}  active={editor.isActive({ textAlign: 'center' })}  title="Centro"><AlignCenter size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()}   active={editor.isActive({ textAlign: 'right' })}   title="Derecha"><AlignRight size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justificado"><AlignJustify size={14} /></Btn>

        <Sep />

        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()}  active={editor.isActive('bulletList')}  title="Lista"><List size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Lista numerada"><ListOrdered size={14} /></Btn>

        <Sep />

        <Btn onClick={addLink} active={editor.isActive('link')} title="Insertar enlace"><LinkIcon size={14} /></Btn>
        <Btn onClick={handleImageButton} title="Insertar imagen" disabled={uploadingImage}>
          {uploadingImage ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
        </Btn>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea divisoria"><Minus size={14} /></Btn>

        <Sep />

        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer"><Undo size={14} /></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer"><Redo size={14} /></Btn>
      </div>

      {/* Color palette */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-luxury-gray-mid bg-luxury-gray">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setColor(c).run() }}
            title={c}
            className="w-4 h-4 rounded-sm border border-luxury-gray-mid hover:scale-125 transition-transform shrink-0"
            style={{ backgroundColor: c }}
          />
        ))}
        <span className="text-[10px] text-[#555] ml-1 select-none">Color de texto</span>
      </div>

      {/* Editor area */}
      <div
        className="rich-content px-4 py-3 text-sm leading-relaxed cursor-text"
        style={{ minHeight, backgroundColor: '#111111', color: '#ffffff' }}
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
        {editor.isEmpty && (
          <p className="text-[#444] text-sm mt-[-1.4rem] pointer-events-none select-none">{placeholder}</p>
        )}
      </div>

      {uploadingImage && (
        <div className="px-3 py-2 border-t border-luxury-gray-mid bg-luxury-gray flex items-center gap-2 text-xs text-luxury-gray-light">
          <Loader2 size={12} className="animate-spin" />
          Subiendo imagen...
        </div>
      )}
    </div>
  )
}
