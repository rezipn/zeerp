import { Component, OnInit, computed, signal } from '@angular/core';
import { supabase } from '../supabase';
import { Loader } from '../loader/loader';
import { animate } from 'animejs';

interface OrderRef {
  id: string;
  no_order: string;
  style_id: string;
  status: string;
  styles: { kode: string; nama: string } | null;
}

interface MaterialRef {
  id: string;
  kode: string;
  nama: string;
  satuan: string;
}

interface CuttingRow {
  id: string;
  tanggal: string;
  order_id: string;
  material_id: string;
  qty_bahan_terpakai: number;
  qty_hasil: number;
  rincian: string | null;
  sisa_bahan: number;
  catatan: string | null;
  created_at: string;
  orders: OrderRef | null;
  materials: MaterialRef | null;
}

interface StockSum {
  material_id: string;
  qty_masuk: number;
  qty_keluar: number;
}

@Component({
  imports: [Loader],
  selector: 'app-cutting',
  styleUrl: './cutting.scss',
  templateUrl: './cutting.html',
})
export class Cutting implements OnInit {
  batches = signal<CuttingRow[]>([]);
  orders = signal<OrderRef[]>([]);
  materials = signal<MaterialRef[]>([]);
  stockSums = signal<StockSum[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  showForm = signal(false);
  saving = signal(false);
  fTanggal = signal(new Date().toLocaleDateString('en-CA'));
  fOrderId = signal('');
  fMaterialId = signal('');
  fTerpakai = signal('');
  fHasil = signal('');
  fRincian = signal('');
  fSisa = signal('');
  fCatatan = signal('');

  selectedMaterial = computed(
    () => this.materials().find((m) => m.id === this.fMaterialId()) ?? null
  );

  availableStock = computed(() => {
    const id = this.fMaterialId();
    if (!id) return null;
    return this.stockSums()
      .filter((s) => s.material_id === id)
      .reduce((sum, s) => sum + Number(s.qty_masuk) - Number(s.qty_keluar), 0);
  });

  async ngOnInit() {
    const [batchesRes, ordersRes, materialsRes, stockRes] = await Promise.all([
      supabase
        .from('cutting_batches')
        .select('*, orders(no_order, style_id, status, styles(kode, nama)), materials(kode, nama, satuan)')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, no_order, style_id, status, styles(kode, nama)')
        .order('created_at', { ascending: false }),
      supabase.from('materials').select('id, kode, nama, satuan').order('kode'),
      supabase
        .from('stock_movements')
        .select('material_id, qty_masuk, qty_keluar')
        .eq('jenis', 'bahan'),
    ]);

    if (batchesRes.error || ordersRes.error || materialsRes.error || stockRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' +
          (batchesRes.error?.message ??
            ordersRes.error?.message ??
            materialsRes.error?.message ??
            stockRes.error?.message)
      );
      this.loading.set(false);
      return;
    }

    this.batches.set((batchesRes.data ?? []) as CuttingRow[]);
    this.orders.set((ordersRes.data ?? []) as unknown as OrderRef[]);
    this.materials.set(materialsRes.data ?? []);
    this.stockSums.set((stockRes.data ?? []) as StockSum[]);
    this.loading.set(false);
  }

  toggleForm() {
    const open = !this.showForm();
    this.showForm.set(open);
    if (open) requestAnimationFrame(() => this.animateFormIn());
  }

  animateFormIn() {
    if (!document.querySelector('.cutting-form-panel')) return;
    animate('.cutting-form-panel', {
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
    return Number(n).toLocaleString('id-ID', { maximumFractionDigits: 4 });
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

  async addCutting() {
    const order = this.orders().find((o) => o.id === this.fOrderId());
    const material = this.selectedMaterial();
    const terpakai = this.parseNum(this.fTerpakai());
    const hasil = this.parseNum(this.fHasil());
    const sisa = this.parseNum(this.fSisa()) ?? 0;
    if (!order || !material || !terpakai || terpakai <= 0 || !hasil || hasil <= 0) return;
    this.saving.set(true);

    const { data, error } = await supabase
      .from('cutting_batches')
      .insert({
        tanggal: this.fTanggal(),
        order_id: order.id,
        material_id: material.id,
        qty_bahan_terpakai: terpakai,
        qty_hasil: Math.round(hasil),
        rincian: this.fRincian().trim() || null,
        sisa_bahan: sisa,
        catatan: this.fCatatan().trim() || null,
      })
      .select('*, orders(no_order, style_id, status, styles(kode, nama)), materials(kode, nama, satuan)')
      .single();

    if (error) {
      this.saving.set(false);
      this.errorMsg.set('Gagal menyimpan cutting: ' + error.message);
      return;
    }

    const batch = data as CuttingRow;
    const movements: Record<string, unknown>[] = [
  {
    tanggal: this.fTanggal(),
    jenis: 'bahan',
    material_id: material.id,
    order_id: order.id,
    gudang_asal: 'Gudang Bahan',
    qty_masuk: 0,
    qty_keluar: terpakai,
    sumber_transaksi: 'cutting',
    ref_id: batch.id,
    catatan: this.fCatatan().trim() || null,
  },
  {
    tanggal: this.fTanggal(),
    jenis: 'panel',
    material_id: null,
    order_id: order.id,
    gudang_tujuan: 'Cutting',
    qty_masuk: Math.round(hasil),
    qty_keluar: 0,
    sumber_transaksi: 'cutting',
    ref_id: batch.id,
    catatan: this.fRincian().trim() || null,
  },
];
if (sisa > 0) {
  movements.push({
    tanggal: this.fTanggal(),
    jenis: 'bahan',
    material_id: material.id,
    order_id: order.id,
    gudang_tujuan: 'Gudang Bahan',
    qty_masuk: sisa,
    qty_keluar: 0,
    sumber_transaksi: 'cutting',
    ref_id: batch.id,
    catatan: 'Sisa bahan kembali',
  });
}

    const { error: movErr } = await supabase.from('stock_movements').insert(movements);

    if (order.status === 'Baru') {
      await supabase.from('orders').update({ status: 'Cutting' }).eq('id', order.id);
      this.orders.update((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status: 'Cutting' } : o))
      );
    }

    this.saving.set(false);
    this.batches.update((list) => [batch, ...list]);
    this.stockSums.update((list) => [
      ...list,
      { material_id: material.id, qty_masuk: 0, qty_keluar: terpakai },
      ...(sisa > 0 ? [{ material_id: material.id, qty_masuk: sisa, qty_keluar: 0 }] : []),
    ]);
    if (movErr) {
      this.errorMsg.set('Cutting tersimpan, tapi mutasi stok gagal: ' + movErr.message);
      return;
    }
    this.errorMsg.set('');

    this.fMaterialId.set('');
    this.fTerpakai.set('');
    this.fHasil.set('');
    this.fRincian.set('');
    this.fSisa.set('');
    this.fCatatan.set('');

    animate('.cutting-form-panel', {
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