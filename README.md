# Dummy Logic Monitoring System Client

Frontend dashboard untuk memonitor project, item produk, approval, file project, dan dokumen item.

## Stack

- React 19
- Vite
- Zustand
- Supabase
- Cloudinary

## Menjalankan Project

1. Install dependency:

```bash
npm install
```

2. Buat file environment dari contoh:

```bash
copy .env.example .env
```

3. Isi variabel berikut di `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`

4. Jalankan development server:

```bash
npm run dev
```

## Struktur Penting

- `src/App.jsx`: layout utama dan pemilihan project aktif
- `src/components/GeneralInfo.jsx`: info project dan file project
- `src/components/ProductList.jsx`: tabel order item per project
- `src/components/ProductDetail.jsx`: form edit item produk
- `src/components/ApprovalButtons.jsx`: approval level project
- `src/components/ProductApprovalCell.jsx`: approval per dokumen item
- `src/components/DocumentUpload.jsx`: dokumen tambahan per item
- `src/lib/supabase.js`: koneksi Supabase
- `src/lib/cloudinary.js`: upload file ke Cloudinary

## Catatan

- Upload Cloudinary diasumsikan memakai `unsigned upload preset`, jadi secret tidak disimpan di frontend.
- Frontend ini mengasumsikan tabel Supabase seperti `projects`, `order_items`, `project_files`, `documents`, `approvals`, dan `product_approvals` sudah tersedia.
