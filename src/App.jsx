import React, { useMemo, useRef, useState } from 'react'
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import JSZip from 'jszip'
import {
  FileText, Merge, Scissors, Minimize2, Image, Images, RotateCw,
  Trash2, ArrowUpDown, UnlockKeyhole, Info, Search, ShieldCheck,
  UploadCloud, Download, CheckCircle2, X, Menu, ChevronRight,
  Sparkles, LockKeyhole, RefreshCw, FileImage, Layers, Settings2
} from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url
).toString()

const tools = [
  { id: 'merge', name: 'Merge PDF', desc: 'Combine multiple PDFs into one file.', icon: Merge, group: 'Organize PDF', color: 'violet' },
  { id: 'split', name: 'Split PDF', desc: 'Extract a page range into a new PDF.', icon: Scissors, group: 'Organize PDF', color: 'pink' },
  { id: 'compress', name: 'Compress PDF', desc: 'Reduce file size by optimizing page images.', icon: Minimize2, group: 'Optimize PDF', color: 'blue' },
  { id: 'pdf-jpg', name: 'PDF to JPG', desc: 'Convert every PDF page into a JPG image.', icon: Image, group: 'Convert PDF', color: 'orange' },
  { id: 'jpg-pdf', name: 'JPG to PDF', desc: 'Turn images into a single PDF document.', icon: Images, group: 'Convert PDF', color: 'green' },
  { id: 'rotate', name: 'Rotate PDF', desc: 'Rotate all pages by 90, 180 or 270 degrees.', icon: RotateCw, group: 'Organize PDF', color: 'blue' },
  { id: 'remove', name: 'Remove Pages', desc: 'Delete pages you do not need.', icon: Trash2, group: 'Organize PDF', color: 'pink' },
  { id: 'organize', name: 'Organize PDF', desc: 'Reorder pages using a page sequence.', icon: ArrowUpDown, group: 'Organize PDF', color: 'violet' },
  { id: 'unlock', name: 'Unlock PDF', desc: 'Try to save an accessible PDF without its open password.', icon: UnlockKeyhole, group: 'Security', color: 'green' },
  { id: 'metadata', name: 'PDF Metadata', desc: 'Inspect title, author, dates and page count.', icon: Info, group: 'More tools', color: 'orange' },
]

const groups = ['All tools', 'Organize PDF', 'Optimize PDF', 'Convert PDF', 'Security', 'More tools']

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function parsePages(input, total) {
  const pages = new Set()
  input.split(',').map(s => s.trim()).filter(Boolean).forEach(part => {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number)
      if (Number.isInteger(a) && Number.isInteger(b) && a > 0 && b >= a && b <= total)
        for (let i = a; i <= b; i++) pages.add(i - 1)
    } else {
      const n = Number(part)
      if (Number.isInteger(n) && n > 0 && n <= total) pages.add(n - 1)
    }
  })
  return [...pages].sort((a, b) => a - b)
}
async function loadPdf(file) {
  const bytes = await file.arrayBuffer()
  return PDFDocument.load(bytes)
}
async function renderPdf(file, scale = 1.5, quality = 0.78, type = 'image/jpeg') {
  const data = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const images = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d', { alpha: false })
    await page.render({ canvasContext: ctx, viewport }).promise
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality))
    if (!blob) throw new Error('Could not render a PDF page.')
    images.push({ blob, width: canvas.width, height: canvas.height })
    canvas.width = 0; canvas.height = 0
  }
  return images
}

function App() {
  const [activeTool, setActiveTool] = useState(null)
  const [category, setCategory] = useState('All tools')
  const [query, setQuery] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pageInput, setPageInput] = useState('1-2')
  const [rotation, setRotation] = useState('90')
  const [orderInput, setOrderInput] = useState('')
  const [quality, setQuality] = useState(65)
  const [metadata, setMetadata] = useState(null)
  const fileInput = useRef(null)

  const visibleTools = useMemo(() => tools.filter(t =>
    (category === 'All tools' || t.group === category) &&
    `${t.name} ${t.desc}`.toLowerCase().includes(query.toLowerCase())
  ), [category, query])

  const current = tools.find(t => t.id === activeTool)
  const reset = () => {
    setFiles([]); setError(''); setSuccess(''); setProgress(''); setMetadata(null)
    setPageInput('1-2'); setOrderInput('')
  }
  const openTool = id => { reset(); setActiveTool(id); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const addFiles = incoming => {
    const chosen = [...incoming]
    const valid = chosen.filter(f => f.type === 'application/pdf' || (activeTool === 'jpg-pdf' && f.type.startsWith('image/')))
    if (valid.length !== chosen.length) setError(activeTool === 'jpg-pdf' ? 'Choose PDF or image files supported by your browser.' : 'Please choose valid PDF files.')
    const tooLarge = valid.filter(f => f.size > 100 * 1024 * 1024)
    if (tooLarge.length) setError('Each file must be smaller than 100 MB.')
    setFiles(prev => [...prev, ...valid.filter(f => f.size <= 100 * 1024 * 1024)])
    setSuccess('')
  }
  const removeFile = index => setFiles(prev => prev.filter((_, i) => i !== index))

  async function runTool() {
    setError(''); setSuccess(''); setMetadata(null)
    if (!files.length) { setError('Upload at least one file to continue.'); return }
    setBusy(true)
    try {
      const first = files[0]
      if (activeTool === 'merge') {
        if (files.length < 2) throw new Error('Upload at least two PDFs to merge.')
        const out = await PDFDocument.create()
        for (const file of files) {
          setProgress(`Adding ${file.name}…`)
          const src = await loadPdf(file)
          const copied = await out.copyPages(src, src.getPageIndices())
          copied.forEach(p => out.addPage(p))
        }
        saveBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'merged.pdf')
        setSuccess('Your PDFs have been merged.')
      } else if (activeTool === 'split') {
        const src = await loadPdf(first), selected = parsePages(pageInput, src.getPageCount())
        if (!selected.length) throw new Error('Enter valid page numbers, for example 1-3, 5.')
        const out = await PDFDocument.create()
        const pages = await out.copyPages(src, selected); pages.forEach(p => out.addPage(p))
        saveBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'split-pages.pdf')
        setSuccess(`Exported ${selected.length} page(s).`)
      } else if (activeTool === 'compress') {
        setProgress('Rendering pages and optimizing images…')
        const rendered = await renderPdf(first, 1.35, quality / 100)
        const out = await PDFDocument.create()
        for (const item of rendered) {
          const jpg = await item.blob.arrayBuffer()
          const image = await out.embedJpg(jpg)
          const page = out.addPage([item.width, item.height])
          page.drawImage(image, { x: 0, y: 0, width: item.width, height: item.height })
        }
        saveBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'optimized.pdf')
        setSuccess('Optimized PDF downloaded. This method rasterizes pages, so selectable text, links and vector detail are not preserved.')
      } else if (activeTool === 'pdf-jpg') {
        setProgress('Converting PDF pages…')
        const rendered = await renderPdf(first, 1.7, 0.92)
        const zip = new JSZip()
        rendered.forEach((item, i) => zip.file(`page-${i + 1}.jpg`, item.blob))
        saveBlob(await zip.generateAsync({ type: 'blob' }), 'pdf-pages.zip')
        setSuccess(`Converted ${rendered.length} page(s) into JPG images.`)
      } else if (activeTool === 'jpg-pdf') {
        const out = await PDFDocument.create()
        for (let i = 0; i < files.length; i++) {
          setProgress(`Adding image ${i + 1} of ${files.length}…`)
          const f = files[i], bytes = await f.arrayBuffer()
          let image
          if (f.type === 'image/png') image = await out.embedPng(bytes)
          else image = await out.embedJpg(bytes)
          const page = out.addPage([image.width, image.height])
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
        }
        saveBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'images.pdf')
        setSuccess('Your images have been combined into a PDF.')
      } else if (activeTool === 'rotate') {
        const pdf = await loadPdf(first), angle = Number(rotation)
        pdf.getPages().forEach(p => p.setRotation(degrees((p.getRotation().angle + angle) % 360)))
        saveBlob(new Blob([await pdf.save()], { type: 'application/pdf' }), 'rotated.pdf')
        setSuccess(`All pages rotated by ${angle} degrees.`)
      } else if (activeTool === 'remove') {
        const pdf = await loadPdf(first), remove = new Set(parsePages(pageInput, pdf.getPageCount()))
        if (!remove.size) throw new Error('Enter valid page numbers to remove.')
        if (remove.size === pdf.getPageCount()) throw new Error('You cannot remove every page.')
        const out = await PDFDocument.create()
        const keep = pdf.getPageIndices().filter(i => !remove.has(i))
        const pages = await out.copyPages(pdf, keep); pages.forEach(p => out.addPage(p))
        saveBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'pages-removed.pdf')
        setSuccess(`Removed ${remove.size} page(s).`)
      } else if (activeTool === 'organize') {
        const pdf = await loadPdf(first)
        const order = pageInput.split(',').map(s => Number(s.trim()) - 1)
        if (!order.length || order.some(n => !Number.isInteger(n) || n < 0 || n >= pdf.getPageCount()) || new Set(order).size !== order.length)
          throw new Error(`Enter a valid page order, e.g. 3,1,2. This creates a PDF containing only the listed pages. Total pages: ${pdf.getPageCount()}.`)
        const out = await PDFDocument.create()
        const pages = await out.copyPages(pdf, order); pages.forEach(p => out.addPage(p))
        saveBlob(new Blob([await out.save()], { type: 'application/pdf' }), 'reordered.pdf')
        setSuccess('Reordered PDF downloaded.')
      } else if (activeTool === 'unlock') {
        setProgress('Checking whether this PDF can be opened…')
        try {
          const pdf = await loadPdf(first)
          saveBlob(new Blob([await pdf.save()], { type: 'application/pdf' }), 'unlocked-copy.pdf')
          setSuccess('A new copy was saved. This only works when the PDF can already be opened by the browser; it does not bypass an unknown open password or DRM.')
        } catch {
          throw new Error('This PDF appears encrypted or unsupported. This browser-only tool cannot bypass an unknown password or DRM. Use the password supplied by the document owner.')
        }
      } else if (activeTool === 'metadata') {
        const pdf = await loadPdf(first)
        setMetadata({
          'File name': first.name, 'File size': formatBytes(first.size), 'Pages': pdf.getPageCount(),
          'Title': pdf.getTitle() || 'Not set', 'Author': pdf.getAuthor() || 'Not set',
          'Subject': pdf.getSubject() || 'Not set', 'Creator': pdf.getCreator() || 'Not set',
          'Producer': pdf.getProducer() || 'Not set',
          'Created': pdf.getCreationDate()?.toLocaleString() || 'Not set',
          'Modified': pdf.getModificationDate()?.toLocaleString() || 'Not set'
        })
        setSuccess('Metadata loaded.')
      }
    } catch (e) {
      setError(e?.message || 'Something went wrong while processing this file.')
    } finally {
      setBusy(false); setProgress('')
    }
  }

  const isImageMode = activeTool === 'jpg-pdf'
  const needsPages = ['split', 'remove', 'organize'].includes(activeTool)
  const actionLabel = ({ merge: 'Merge PDFs', split: 'Extract pages', compress: 'Optimize PDF', 'pdf-jpg': 'Convert to JPG', 'jpg-pdf': 'Create PDF', rotate: 'Rotate PDF', remove: 'Remove pages', organize: 'Reorder pages', unlock: 'Create unlocked copy', metadata: 'Read metadata' })[activeTool]

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="nav-wrap">
          <button className="brand" onClick={() => { setActiveTool(null); reset() }} aria-label="PDF Toolkit home">
            <span className="brand-mark"><FileText size={23}/></span><span>pdf<span className="brand-purple">toolkit</span></span>
          </button>
          <nav className={mobileOpen ? 'nav-links open' : 'nav-links'}>
            <a href="#tools" onClick={() => setMobileOpen(false)}>All tools</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)}>How it works</a>
            <a href="#privacy" onClick={() => setMobileOpen(false)}>Privacy</a>
          </nav>
          <div className="nav-right"><span className="secure-pill"><ShieldCheck size={14}/> Files stay on your device</span><button className="mobile-menu" onClick={() => setMobileOpen(v => !v)}><Menu/></button></div>
        </div>
      </header>

      {!activeTool ? <>
        <main>
          <section className="hero">
            <div className="hero-glow"></div>
            <div className="hero-content">
              <div className="eyebrow"><Sparkles size={14}/> SIMPLE TOOLS. BETTER PDF WORKFLOWS.</div>
              <h1>Everything you need<br/>to work with <span>PDFs.</span></h1>
              <p>Merge, split, compress and convert your documents with easy-to-use tools. Free to use, right in your browser.</p>
              <div className="hero-search"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search for a PDF tool…"/><kbd>⌘ K</kbd></div>
              <div className="hero-note"><ShieldCheck size={16}/> Your files are processed locally. No account required.</div>
            </div>
            <div className="hero-art" aria-hidden="true"><div className="art-circle"></div><div className="floating-card card-back"><FileText size={30}/><span>document.pdf</span><small>2.4 MB</small></div><div className="floating-card card-front"><div className="pdf-icon">PDF</div><div><b>Ready when you are</b><small>Fast, simple PDF tools</small></div><CheckCircle2 className="check-icon"/></div><div className="art-spark spark-one">✦</div><div className="art-spark spark-two">✧</div></div>
          </section>

          <section className="tools-section" id="tools">
            <div className="section-heading"><div><span className="section-kicker">PDF TOOLBOX</span><h2>What would you like to do?</h2><p>Choose a tool and get it done in a few clicks.</p></div><span className="tool-count">{visibleTools.length} tools available</span></div>
            <div className="category-row">{groups.map(g => <button key={g} className={category === g ? 'category active' : 'category'} onClick={() => setCategory(g)}>{g}</button>)}</div>
            {visibleTools.length ? <div className="tool-grid">{visibleTools.map(tool => <button className="tool-card" key={tool.id} onClick={() => openTool(tool.id)}><span className={`tool-icon ${tool.color}`}><tool.icon size={22}/></span><span className="tool-card-title">{tool.name}<ChevronRight size={16}/></span><span className="tool-card-desc">{tool.desc}</span></button>)}</div> : <div className="empty-state">No tools found. Try another search.</div>}
          </section>

          <section className="steps-section" id="how-it-works"><div className="section-heading centered"><span className="section-kicker">HOW IT WORKS</span><h2>PDF tasks, made simple.</h2><p>No complicated software. Just three simple steps.</p></div><div className="steps-grid"><div className="step"><span>01</span><UploadCloud/><h3>Choose your file</h3><p>Upload a PDF or image from your device.</p></div><div className="step"><span>02</span><Settings2/><h3>Use your tool</h3><p>Choose your settings and process your document.</p></div><div className="step"><span>03</span><Download/><h3>Download</h3><p>Save your finished file directly to your device.</p></div></div></section>
          <section className="privacy-banner" id="privacy"><div className="privacy-icon"><LockKeyhole size={25}/></div><div><h3>Your documents are yours. Always.</h3><p>PDF Toolkit processes files locally in your browser. Files are not sent to our servers by this app.</p></div><ShieldCheck className="privacy-check" size={28}/></section>
        </main>
      </> : <main className="tool-workspace">
        <button className="back-link" onClick={() => { setActiveTool(null); reset() }}>← Back to all tools</button>
        <div className="workspace-heading"><div className={`tool-icon large ${current?.color}`}><current.icon size={26}/></div><div><span className="section-kicker">{current?.group}</span><h1>{current?.name}</h1><p>{current?.desc}</p></div></div>
        <div className="workspace-grid">
          <section className="work-panel">
            <div className="panel-title"><h2>Upload files</h2><span>Max 100 MB per file</span></div>
            <div className={`dropzone ${files.length ? 'has-files' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); addFiles(e.dataTransfer.files) }} onClick={() => fileInput.current?.click()}>
              <input ref={fileInput} type="file" accept={isImageMode ? 'application/pdf,image/jpeg,image/png,image/webp' : 'application/pdf'} multiple={['merge','jpg-pdf'].includes(activeTool)} hidden onChange={e => { addFiles(e.target.files); e.target.value = '' }}/>
              <span className="upload-icon"><UploadCloud size={27}/></span><b>Drag & drop your {isImageMode ? 'images' : 'PDF'} here</b><span>or <strong>browse files</strong> from your device</span><small>{isImageMode ? 'PDF, JPG, PNG, WebP' : 'PDF files only'} · Up to 100 MB each</small>
            </div>
            {files.length > 0 && <div className="file-list"><div className="file-list-head"><b>{files.length} file{files.length > 1 ? 's' : ''} selected</b><button onClick={reset}>Clear all</button></div>{files.map((f, i) => <div className="file-row" key={`${f.name}-${i}`}><span className="file-type"><FileText size={18}/></span><div className="file-info"><b>{f.name}</b><small>{formatBytes(f.size)}</small></div><button className="icon-button" onClick={() => removeFile(i)} aria-label={`Remove ${f.name}`}><X size={17}/></button></div>)}</div>}
            {needsPages && <div className="setting-block"><label>{activeTool === 'split' ? 'Pages to extract' : activeTool === 'remove' ? 'Pages to remove' : 'New page order'}</label><input value={pageInput} onChange={e => setPageInput(e.target.value)} placeholder={activeTool === 'organize' ? '3,1,2' : '1-3,5'}/><small>{activeTool === 'organize' ? 'Enter page numbers in the exact order you want, e.g. 3,1,2. Unlisted pages are omitted.' : 'Use commas and ranges, e.g. 1-3, 5, 8.'}</small></div>}
            {activeTool === 'rotate' && <div className="setting-block"><label>Rotation angle</label><select value={rotation} onChange={e => setRotation(e.target.value)}><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">270° clockwise</option></select></div>}
            {activeTool === 'compress' && <div className="setting-block"><div className="label-line"><label>Image quality</label><b>{quality}%</b></div><input type="range" min="25" max="90" value={quality} onChange={e => setQuality(Number(e.target.value))}/><small>Lower quality can produce a smaller file. Pages are rasterized; text and links will no longer be selectable.</small></div>}
            {error && <div className="alert error"><X size={17}/>{error}</div>}
            {success && <div className="alert success"><CheckCircle2 size={17}/>{success}</div>}
            {busy && <div className="processing"><span className="spinner"></span><span>{progress || 'Processing your file…'}</span></div>}
            <button className="primary-button" disabled={busy || !files.length} onClick={runTool}>{busy ? 'Processing…' : actionLabel}<ChevronRight size={18}/></button>
            <p className="local-note"><ShieldCheck size={14}/> Processing happens in your browser. Your files are not uploaded.</p>
          </section>
          <aside className="side-panel"><div className="side-illustration"><div className="doc-stack"><FileText size={44}/><span>PDF</span></div><div className="sparkle-dot">✦</div></div><h3>Quick, private PDF tools</h3><p>Work with your documents without creating an account or sending files to a server.</p><div className="side-benefit"><CheckCircle2/> No account required</div><div className="side-benefit"><CheckCircle2/> Local browser processing</div><div className="side-benefit"><CheckCircle2/> Simple, focused tools</div>
            {metadata && <div className="metadata-box"><h4>Document information</h4>{Object.entries(metadata).map(([k,v]) => <div className="metadata-row" key={k}><span>{k}</span><b>{String(v)}</b></div>)}</div>}
          </aside>
        </div>
        <div className="tool-disclaimer"><Info size={16}/><span>For best results, use modern Chrome, Edge, Firefox or Safari. Encrypted, malformed or unusually complex PDFs may not be supported. Keep a copy of your original file.</span></div>
      </main>}
      <footer><div className="footer-inner"><div className="brand footer-brand"><span className="brand-mark"><FileText size={20}/></span><span>pdf<span className="brand-purple">toolkit</span></span></div><span>Simple PDF tools, processed in your browser.</span><span>© {new Date().getFullYear()} PDF Toolkit</span></div></footer>
    </div>
  )
}

export default App
