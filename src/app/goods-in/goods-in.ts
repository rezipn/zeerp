import { Component, OnInit, computed, signal } from '@angular/core';
import { supabase } from '../supabase';
import { Loader } from '../loader/loader';
import { animate } from 'animejs';

interface Supplier {
  id: string;
  nama: string;
}

interface MaterialRef {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
}

interface GoodsInRow {
  id: string;
  tanggal: string;
  supplier_id: string | null;
  material_id: string;
  qty: number;
  satuan: string | null;
  no_lot: string | null;
  ref_dokumen: string | null;
  catatan: string | null;
  created_at: string;
  suppliers: Supplier | null;
  materials: MaterialRef | null;
}

@Component({
  imports: [Loader],
  selector: 'app-goods-in',
  styleUrl: './goods-in.scss',
  templateUrl: './goods-in.html',
})
export class GoodsIn implements OnInit {
  receipts = signal<GoodsInRow[]>([]);
  suppliers = signal<Supplier[]>([]);
  materials = signal<MaterialRef[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  showForm = signal(false);
  saving = signal(false);
  fTanggal = signal(new Date().toLocaleDateString('en-CA'));
  fSupplierId = signal('');
  fSupplierBaru = signal('');
  fMaterialId = signal('');
  fQty = signal('');
  fNoLot = signal('');
  fRefDokumen = signal('');
  fCatatan = signal('');

  selectedMaterial = computed(
    () => this.materials().find((m) => m.id === this.fMaterialId()) ?? null
  );

  async ngOnInit() {
    const [receiptsRes, suppliersRes, materialsRes] = await Promise.all([
      supabase
        .from('goods_in')
        .select('*, suppliers(nama), materials(kode, nama, satuan)')
        .order('created_at', { ascending: false }),
      supabase.from('suppliers').select('id, nama').order('nama'),
      supabase.from('materials').select('id, kode, nama, satuan').order('kode'),
    ]);

    if (receiptsRes.error || suppliersRes.error || materialsRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' +
          (receiptsRes.error?.message ?? suppliersRes.error?.message ?? materialsRes.error?.message)
      );
      this.loading.set(false);
      return;
    }

    this.receipts.set((receiptsRes.data ?? []) as GoodsInRow[]);
    this.suppliers.set(suppliersRes.data ?? []);
    this.materials.set(materialsRes.data ?? []);
    this.loading.set(false);
  }

  toggleForm() {
    const open = !this.showForm();
    this.showForm.set(open);
    if (open) {
      requestAnimationFrame(() => this.animateFormIn());
    }
  }

  animateFormIn() {
    if (!document.querySelector('.receipt-form-panel')) return;
    animate('.receipt-form-panel', {
      opacity: [0, 1],
      y: [-12, 0],
      duration: 380,
      ease: 'outQuad',
    });
  }

  animateNewRow() {
    const row = document.querySelector('tbody tr:first-child');
    if (!row) return;
    animate(row, {
      opacity: [0, 1],
      y: [10, 0],
      backgroundColor: ['rgba(59, 130, 246, 0.35)', 'rgba(59, 130, 246, 0)'],
      duration: 700,
      ease: 'outQuad',
    });
  }

  formatNum(n: number | null): string {
    if (n === null || n === undefined) return '';
    return n.toLocaleString('id-ID', { maximumFractionDigits: 4 });
  }

  parseNum(s: string): number | null {
    const t = s.replace(/\s/g, '');
    if (t === '') return null;
    let normalized: string;
    if (t.includes(',')) {
      normalized = t.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
      normalized = t.replace(/\./g, '');
    } else {
      normalized = t;
    }
    const n = Number(normalized);
    return Number.isNaN(n) ? null : n;
  }

  onQtyInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    const cursor = input.selectionStart ?? raw.length;
    const charsBeforeCursor = raw.slice(0, cursor).replace(/[^0-9,]/g, '').length;

    const commaIdx = raw.indexOf(',');
    let intPart = commaIdx >= 0 ? raw.slice(0, commaIdx) : raw;
    const decPart = commaIdx >= 0 ? raw.slice(commaIdx + 1).replace(/\D/g, '') : null;
    intPart = intPart.replace(/\D/g, '');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const formatted = decPart !== null ? formattedInt + ',' + decPart : formattedInt;

    input.value = formatted;

    let pos = 0;
    let seen = 0;
    while (pos < formatted.length && seen < charsBeforeCursor) {
      if (/[0-9,]/.test(formatted[pos])) seen++;
      pos++;
    }
    input.setSelectionRange(pos, pos);
  }

  formatDate(d: string | null): string {
    if (!d) return '-';
    return new Date(d + 'T00:00:00').toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  async addReceipt() {
    const material = this.selectedMaterial();
    const qty = this.parseNum(this.fQty());
    if (!material || !qty || qty <= 0) return;
    this.saving.set(true);

    let supplierId = this.fSupplierId() || null;
    const supplierBaru = this.fSupplierBaru().trim();
    if (supplierBaru) {
      const { data: sup, error: supErr } = await supabase
        .from('suppliers')
        .insert({ nama: supplierBaru })
        .select('id, nama')
        .single();
      if (supErr) {
        this.saving.set(false);
        this.errorMsg.set('Gagal menambah supplier: ' + supErr.message);
        return;
      }
      supplierId = sup.id;
      this.suppliers.update((list) =>
        [...list, sup as Supplier].sort((a, b) => a.nama.localeCompare(b.nama))
      );
    }

    const { data, error } = await supabase
      .from('goods_in')
      .insert({
        tanggal: this.fTanggal(),
        supplier_id: supplierId,
        material_id: material.id,
        qty,
        satuan: material.satuan,
        no_lot: this.fNoLot().trim() || null,
        ref_dokumen: this.fRefDokumen().trim() || null,
        catatan: this.fCatatan().trim() || null,
      })
      .select('*, suppliers(nama), materials(kode, nama, satuan)')
      .single();

    if (error) {
      this.saving.set(false);
      this.errorMsg.set('Gagal menyimpan barang masuk: ' + error.message);
      return;
    }

    const receipt = data as GoodsInRow;
    const { error: movErr } = await supabase.from('stock_movements').insert({
      tanggal: this.fTanggal(),
      jenis: 'bahan',
      material_id: material.id,
      gudang_tujuan: 'Gudang Bahan',
      qty_masuk: qty,
      sumber_transaksi: 'barang_masuk',
      ref_id: receipt.id,
      catatan: this.fCatatan().trim() || null,
    });

    this.saving.set(false);
    this.receipts.update((list) => [receipt, ...list]);
    if (movErr) {
      this.errorMsg.set('Barang masuk tersimpan, tapi mutasi stok gagal: ' + movErr.message);
      return;
    }
    this.errorMsg.set('');

    this.fSupplierId.set('');
    this.fSupplierBaru.set('');
    this.fMaterialId.set('');
    this.fQty.set('');
    this.fNoLot.set('');
    this.fRefDokumen.set('');
    this.fCatatan.set('');

    animate('.receipt-form-panel', {
      opacity: [1, 0],
      y: [0, -8],
      duration: 220,
      ease: 'inQuad',
    });
    setTimeout(() => {
      this.showForm.set(false);
      requestAnimationFrame(() => this.animateNewRow());
    }, 220);
  }
}