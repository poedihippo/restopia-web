# Panduan Mengatur Satuan Produk (UOM) untuk Gudang

Dokumen ini dibuat untuk tim gudang agar bisa mengatur satuan produk sendiri di aplikasi tanpa bantuan programmer.

---

## 1. Apa itu UOM?

**UOM** = Unit of Measure = **Satuan produk**.

Contoh satuan yang sering dipakai di gudang:

- GR = Gram
- KG = Kilogram
- PCS = Pieces / Bungkus / Pcs
- PACK = Pack / Kardus / Dus

---

## 2. Apa itu Base Unit?

**Base Unit** = satuan paling kecil yang dipakai untuk menghitung stok.

> **Contoh:** Kalau base unit = GR, maka semua stok di gudang dihitung dalam gram, meskipun barang masuknya dalam PACK atau PCS.

### Kenapa harus pakai satuan terkecil?

Supaya perhitungan stok **tidak berbeda-beda**. Misalnya:

- Masuk: 2 PACK
- Keluar: 500 GR
- Kalau semua diubah ke GR, stok tetap terhitung dengan benar.

---

## 3. Contoh Kasus: New Topping Choco

### Bentuk kemasan asli:

```
1 PACK = 6 PCS
1 PCS  = 2 KG
1 KG   = 1000 GR
```

### Berapa GR dalam 1 PACK?

```
1 PACK = 6 PCS × 2 KG × 1000 GR
1 PACK = 12000 GR
```

### Jika PO qty = 3 PACK, stok masuk berapa GR?

```
3 PACK × 12000 GR = 36000 GR
```

---

## 4. Cara Edit / Tambah Produk

### Langkah 1: Buka Menu Produk

1. Login ke aplikasi.
2. Klik menu **Products** di sidebar.
3. Cari produk yang mau diedit, misalnya **New Topping Choco**.
4. Klik tombol **Edit** (ikon pensil).

### Langkah 2: Atur Base Unit

Cari bagian **Base Unit**.

- Pilih **GR** (Gram).
- Ini artinya: semua stok untuk produk ini akan dihitung dalam gram.

### Langkah 3: Tambah Satuan (Units & Prices)

Gulir ke bawah ke bagian **Units & Prices**.

Klik tombol **Add Unit** untuk menambah satuan.

Isi data seperti tabel berikut:

| Unit | SKU Code | Base Price | Conversion Target | Amount |
|------|----------|------------|-------------------|--------|
| GR | `34060003-GR` | isi harga per GR | — | — |
| KG | `34060003-KG` | isi harga per KG | GR | 1000 |
| PCS | `34060003-PCS` | isi harga per PCS | GR | 2000 |
| PACK | `34060003-PACK` | isi harga per PACK | GR | 12000 |

> **SKU Code** boleh dibuat sendiri. Yang penting unik (tidak sama dengan produk lain).

### Langkah 4: SKU Code Otomatis (Auto-Generate)

Setelah Anda pilih **Unit** (misalnya KG), kolom **SKU Code** akan otomatis terisi dengan pola:

```
{SKU Produk}-{Kode UOM}
```

Contoh:

- SKU Produk = `ASD`
- Pilih Unit = `KG`
- Maka SKU Code otomatis jadi: `ASD-KG`

> **Catatan:** Auto-generate hanya berjalan kalau kolom SKU Code masih kosong. Kalau Anda sudah ketik manual, sistem tidak akan mengganti.

### Langkah 5: Isi Conversion

Conversion = faktor pengali dari satu satuan ke satuan lain.

Contoh pengisian conversion:

#### KG → GR

- **Converts to:** GR
- **Amount:** 1000
- Artinya: 1 KG = 1000 GR

#### PCS → GR

- **Converts to:** GR
- **Amount:** 2000
- Artinya: 1 PCS = 2000 GR (karena 1 PCS = 2 KG)

#### PACK → GR

- **Converts to:** GR
- **Amount:** 12000
- Artinya: 1 PACK = 12000 GR (karena 1 PACK = 6 PCS × 2000 GR)

### Langkah 6: Cek Rantai Konversi (Konversi ke Base Unit)

Setelah semua satuan dan conversion diisi, di setiap kartu satuan akan muncul kotak **Konversi ke Base Unit**.

Contoh tampilan:

```
Konversi ke Base Unit
1 PACK = 6 PCS = 10884 ML
```

Atau untuk satuan tengah:

```
Konversi ke Base Unit
1 PCS = 907 ML
```

> **Kotak merah** berarti satuan itu belum punya jalur konversi ke Base Unit. Periksa kembali conversion-nya.

### Langkah 7: Pilih Default Unit

Klik tombol **Default** di satuan yang paling sering dipakai untuk transaksi.

> **Tips:** Kalau PO biasanya dibeli per PACK, maka PACK yang dijadikan default.

### Langkah 7: Simpan

Klik tombol **Save Changes** di pojok kanan bawah.

---

## 5. Cara Membaca Hasil PO

Setelah setup di atas, saat membuat Purchase Order (PO):

| Qty di PO | Satuan | Stok yang Masuk (GR) |
|-----------|--------|----------------------|
| 3 | PACK | 3 × 12000 = **36000 GR** |
| 5 | PCS | 5 × 2000 = **10000 GR** |
| 2 | KG | 2 × 1000 = **2000 GR** |

---

## 6. Hal yang Sering Salah

### A. Conversion ke satuan bukan Base Unit

**Salah:**

- PCS → KG = 2
- PACK → PCS = 6

Ini benar secara matematika, **tapi** kalau sistem tidak bisa menghitung rantai konversi (PCS → KG → GR), maka PACK tidak tahu harus diubah ke GR.

**Hasilnya:** stok yang masuk bisa salah.

### B. Base unit tidak diisi GR

Kalau base unit = KG, maka semua stok dihitung dalam KG. Ini boleh-boleh saja, tapi harus konsisten untuk semua produk.

> **Rekomendasi:** pakai satuan terkecil (GR) supaya presisi.

### C. SKU Code sama dengan produk lain

Setiap SKU Code harus unik. Kalau sama, sistem akan menolak saat disimpan.

### D. Amount conversion terbalik

**Salah:**

- GR → KG = 1000 (ini artinya 1 GR = 1000 KG, salah!)

**Benar:**

- KG → GR = 1000 (1 KG = 1000 GR)

Ingat: satuan di baris atas adalah 1, lalu amount adalah berapa satuan target.

---

## 7. Contoh Lain: Chocolate Whip Topping (1 × 12 × 907 ml)

### Bentuk kemasan:

```
1 CTN (Karton) = 12 BTL (Botol)
1 BTL = 907 ML
Base = ML
```

### Setup:

| Unit | SKU Code | Conversion Target | Amount | Tampilan Rantai |
|------|----------|-------------------|--------|-----------------|
| ML | 23160102-ML | — | — | 1 ML = 1 ML |
| BTL | 23160102-BTL | ML | 907 | 1 BTL = 907 ML |
| CTN | 23160102-CTN | BTL | 12 | 1 CTN = 12 BTL = 10884 ML |

### PO 2 CTN:

```
2 × 10884 ML = 21768 ML
```

> **Catatan:** Untuk CTN, sistem menghitung otomatis melalui BTL ke ML. Kalau tampilan kotak konversi tidak muncul atau warnanya merah, berarti ada conversion yang belum lengkap.

---

## 8. Contoh Lain: Minyak Goreng

### Kemasan:

- 1 Karton = 12 Botol
- 1 Botol = 1000 ML
- Base unit = ML

### Setup:

| Unit | SKU Code | Conversion Target | Amount |
|------|----------|-------------------|--------|
| ML | MINYAK-ML | — | — |
| BOTOL | MINYAK-BTL | ML | 1000 |
| KARTON | MINYAK-KRT | ML | 12000 |

### PO 2 Karton:

```
2 × 12000 ML = 24000 ML
```

---

## 9. Checklist Sebelum Simpan

Sebelum klik Save, pastikan:

- [ ] Base Unit sudah dipilih (biasanya satuan terkecil).
- [ ] Semua satuan yang dipakai sudah ditambah.
- [ ] SKU Code sudah terisi (bisa otomatis atau manual), dan unik.
- [ ] Conversion diisi ke Base Unit (GR), bukan ke satuan tengah.
- [ ] Amount conversion sudah benar, tidak terbalik.
- [ ] Satuan default sudah dipilih.

---

## 10. Butuh Bantuan?

Kalau ada produk yang bentuknya rumit atau hasil PO tidak sesuai, catat:

1. Nama produk
2. Base unit yang dipilih
3. Daftar satuan dan conversion-nya
4. Contoh PO yang hasilnya salah

Lalu hubungi tim IT / programmer untuk dicek.

---

**Versi:** 1.0  
**Terakhir diupdate:** 17 September 2026
