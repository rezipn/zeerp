# zeerp — ERP Garment Berbasis Web

![Angular](https://img.shields.io/badge/Angular-Standalone%20Components-dd0031?logo=angular)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth-3ecf8e?logo=supabase)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript)
![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-222222?logo=github)

ERP garment berbasis web untuk **PT Jumpwin Sports Indonesia** — mengelola alur produksi dari order, barang masuk, gudang bahan, cutting, produksi, finishing & QC, sampai gudang finish good dan pengiriman. Dibangun dengan Angular + Supabase, dengan ledger mutasi stok sebagai sumber kebenaran (stok tidak pernah diketik langsung, selalu dihitung dari mutasi).

![Demo zeerp](docs/demo.gif)

## 🔗 Live Demo

**https://rezipn.github.io/zeerp/**

Akun demo:

| Email | Password |
|---|---|
| reziipn@gmail.com | ZeeRp240401! |

## ✨ Fitur

| Modul | Keterangan | Status |
|---|---|---|
| 🔐 Login & Auth | Supabase Auth + route guard, login animasi interaktif (Anime.js) | ✅ |
| 📋 Master Data — Style & BOM | Style, bahan, resep bahan per pcs (BOM), tambah/hapus item | ✅ |
| 🧾 Order & Style | Order per buyer & style, qty, rincian ukuran, target selesai | ✅ |
| 📦 Barang Masuk | Penerimaan bahan dari supplier, stok bertambah otomatis via ledger | ✅ |
| 🏭 Gudang Bahan | Stok per bahan dari ledger mutasi + kartu stok per bahan | ✅ |
| ✂️ Cutting | Bahan terpakai, hasil panel, sisa bahan kembali, stok panel per order | ✅ |
| 🧵 Produksi | Hasil sewing, panel & aksesoris terpotong otomatis dari BOM, masuk WIP | ✅ |
| ✅ Finishing & QC | Hasil QC lulus/reject/repair — lulus ke Gudang FG, reject ke Barang Sisa | ✅ |
| 📦 Gudang FG | Stok finish good siap kirim + pencatatan pengiriman per order | ✅ |
| ♻️ Barang Sisa | Stok reject per order + pengeluaran (jual/pakai ulang/buang) | ✅ |
| 📊 Dashboard KPI | Kartu ringkasan, progres per order, chart animasi (ECharts) | ✅ |
| ⌘K Pencarian Cepat | Command palette ke semua halaman | ⏳ |
| 👥 Role Pengguna | Admin, gudang, produksi, viewer — menu & RLS per role | ⏳ |

## 🖼️ Screenshot

### Style & BOM — Master Data
![Style & BOM](docs/screenshots/style-bom.png)

### Barang Masuk — Penerimaan Bahan
![Barang Masuk](docs/screenshots/barang-masuk.png)

### Gudang Bahan — Stok & Kartu Stok
![Gudang Bahan](docs/screenshots/gudang-bahan.png)

### Cutting — Pemotongan Bahan
![Cutting](docs/screenshots/cutting.png)

## 🛠️ Tech Stack

- **Frontend:** Angular (Standalone Components, Signals, Reactive Forms), SCSS, Anime.js, Lottie, ECharts
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security, REST API)
- **Deploy:** GitHub Pages (auto-deploy via GitHub Actions)
- **Desain:** Liquid Glass dark UI, font Poppins

## 🧭 Roadmap

- [x] **Tahap 0** — Fondasi: login, auth guard, shell sidebar
- [x] **Tahap 1** — Master Data: Style & BOM
- [x] **Tahap 2** — Order, Barang Masuk, Gudang Bahan (ledger stok)
- [x] **Tahap 3** — Cutting + Produksi (panel & WIP di ledger)
- [x] **Tahap 4** — Finishing & QC, Gudang FG, Gudang Barang Sisa
- [ ] **Tahap 5** — Dashboard KPI ✅, pencarian ⌘K, role pengguna, uji tim, mobile pass

## ▶️ Menjalankan Lokal

```bash
npm install
ng serve
```

Lalu buka `http://localhost:4200`. Konfigurasi Supabase ada di `src/app/supabase.ts`.

---

Dibuat oleh [Rezi Palifta Nadaredo](https://github.com/rezipn) — IT Inventory Staff, PT Jumpwin Sports Indonesia.
