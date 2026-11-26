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

interface BomRef {
  id: string;
  style_id: string;
  material_id: string;
  kebutuhan_per_pcs: number | null;
  materials: { kode: string; nama: string; jenis: string | null; satuan: string };
}

interface ProductionRow {
  id: string;
  tanggal: string;
  order_id: string;
  qty_selesai: number;
  catatan: string | null;
  created_at: string;
  orders: OrderRef | null;
}

interface MovementSum {
  material_id: string | null;
  order_id: string | null;
  qty_masuk: number;
  qty_keluar: number;
}

@Component({
  imports: [Loader],
  selector: 'app-production',
  styleUrl: './production.scss',
  templateUrl: './production.html',
})
export class Production implements OnInit {
  batches = signal<ProductionRow[]>([]);
  orders = signal<OrderRef[]>([]);
  bomItems = signal<BomRef[]>([]);
  panelMovements = signal<MovementSum[]>([]);
  bahanMovements = signal<MovementSum[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  showForm = signal(false);
  saving = signal(false);
  fTanggal = signal(new Date().toLocaleDateString('en-CA'));
  fOrderId = signal('');
  fQty = signal('');
  fCatatan = signal('');

  panelStock = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.panelMovements()) {
      if (!m.order_id) continue;
      map.set(m.order_id, (map.get(m.order_id) ?? 0) + Number(m.qty_masuk) - Number(m.qty_keluar));
    }
    return map;
  });

  panelRows = computed(() =>
    this.orders()
      .filter((o) => this.panelStock().has(o.id))
      .map((o) => ({ ...o, panel: this.panelStock().get(o.id) ?? 0 })),
  );

  selectedOrder = computed(() => this.orders().find((o) => o.id === this.fOrderId()) ?? null);

  panelAvailable = computed(() => {
    const id = this.fOrderId();
    return id ? (this.panelStock().get(id) ?? 0) : null;
  });

  bahanStock = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.bahanMovements()) {
      if (!m.material_id) continue;
      map.set(
        m.material_id,
        (map.get(m.material_id) ?? 0) + Number(m.qty_masuk) - Number(m.qty_keluar),
      );
    }
    return map;
  });

  accessoryPreview = computed(() => {
    const order = this.selectedOrder();
    const qty = this.parseNum(this.fQty()) ?? 0;
    if (!order) return [];
    return this.bomItems()
      .filter(
        (b) =>
          b.style_id === order.style_id &&
          b.materials.jenis === 'Aksesoris' &&
          b.kebutuhan_per_pcs !== null &&
          Number(b.kebutuhan_per_pcs) > 0,
      )
      .map((b) => ({
        kode: b.materials.kode,
        nama: b.materials.nama,
        satuan: b.materials.satuan,
        perPcs: Number(b.kebutuhan_per_pcs),
        total: Number(b.kebutuhan_per_pcs) * qty,
        stok: this.bahanStock().get(b.material_id) ?? 0,
      }));
  });

  async ngOnInit() {
    const [batchesRes, ordersRes, bomRes, panelRes, bahanRes] = await Promise.all([
      supabase
        .from('production_batches')
        .select('*, orders(no_order, style_id, status, styles(kode, nama))')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, no_order, style_id, status, styles(kode, nama)')
        .order('created_at', { ascending: false }),
      supabase.from('bom_items').select('*, materials(kode, nama, jenis, satuan)'),
      supabase
        .from('stock_movements')
        .select('material_id, order_id, qty_masuk, qty_keluar')
        .eq('jenis', 'panel'),
      supabase
        .from('stock_movements')
        .select('material_id, order_id, qty_masuk, qty_keluar')
        .eq('jenis', 'bahan'),
    ]);

    if (batchesRes.error || ordersRes.error || bomRes.error || panelRes.error || bahanRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' +
          (batchesRes.error?.message ??
            ordersRes.error?.message ??
            bomRes.error?.message ??
            panelRes.error?.message ??
            bahanRes.error?.message),
      );
      this.loading.set(false);
      return;
    }

    this.batches.set((batchesRes.data ?? []) as ProductionRow[]);
    this.orders.set((ordersRes.data ?? []) as unknown as OrderRef[]);
    this.bomItems.set((bomRes.data ?? []) as BomRef[]);
    this.panelMovements.set((panelRes.data ?? []) as MovementSum[]);
    this.bahanMovements.set((bahanRes.data ?? []) as MovementSum[]);
    this.loading.set(false);
  }

  toggleForm() {
    const open = !this.showForm();
    this.showForm.set(open);
    if (open) requestAnimationFrame(() => this.animateFormIn());
  }

  pickOrder(id: string) {
    this.fOrderId.set(id);
    if (!this.showForm()) {
      this.showForm.set(true);
      requestAnimationFrame(() => this.animateFormIn());
    }
  }

  animateFormIn() {
    if (!document.querySelector('.production-form-panel')) return;
    animate('.production-form-panel', {
      opacity: [0, 1],
      y: [-12, 0],
      duration: 380,
      ease: 'outQuad',
    });
  }

  animateNewRow() {
    const row = document.querySelector('.batch-table tbody tr:first-child');
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

  async addProduction() {
    const order = this.selectedOrder();
    const qty = this.parseNum(this.fQty());
    if (!order || !qty || qty <= 0) return;
    const qtyInt = Math.round(qty);
    const available = this.panelAvailable() ?? 0;
    if (qtyInt > available) {
      this.errorMsg.set(
        `Qty selesai (${this.formatNum(qtyInt)}) melebihi stok panel order ini (${this.formatNum(available)} pcs). Tambah cutting dulu.`,
      );
      return;
    }
    this.saving.set(true);

    const { data, error } = await supabase
      .from('production_batches')
      .insert({
        tanggal: this.fTanggal(),
        order_id: order.id,
        qty_selesai: qtyInt,
        catatan: this.fCatatan().trim() || null,
      })
      .select('*, orders(no_order, style_id, status, styles(kode, nama))')
      .single();

    if (error) {
      this.saving.set(false);
      this.errorMsg.set('Gagal menyimpan produksi: ' + error.message);
      return;
    }

    const batch = data as ProductionRow;
    const movements: Record<string, unknown>[] = [
      {
        tanggal: this.fTanggal(),
        jenis: 'panel',
        material_id: null,
        order_id: order.id,
        gudang_asal: 'Cutting',
        qty_masuk: 0,
        qty_keluar: qtyInt,
        sumber_transaksi: 'produksi',
        ref_id: batch.id,
        catatan: this.fCatatan().trim() || null,
      },
      {
        tanggal: this.fTanggal(),
        jenis: 'wip',
        material_id: null,
        order_id: order.id,
        gudang_tujuan: 'Produksi',
        qty_masuk: qtyInt,
        qty_keluar: 0,
        sumber_transaksi: 'produksi',
        ref_id: batch.id,
        catatan: this.fCatatan().trim() || null,
      },
    ];

    const accessories = this.bomItems().filter(
      (b) =>
        b.style_id === order.style_id &&
        b.materials.jenis === 'Aksesoris' &&
        b.kebutuhan_per_pcs !== null &&
        Number(b.kebutuhan_per_pcs) > 0,
    );
    for (const acc of accessories) {
      movements.push({
        tanggal: this.fTanggal(),
        jenis: 'bahan',
        material_id: acc.material_id,
        order_id: order.id,
        gudang_asal: 'Gudang Bahan',
        qty_masuk: 0,
        qty_keluar: Number(acc.kebutuhan_per_pcs) * qtyInt,
        sumber_transaksi: 'produksi',
        ref_id: batch.id,
        catatan: null,
      });
    }

    const { error: movErr } = await supabase.from('stock_movements').insert(movements);

    if (order.status === 'Baru' || order.status === 'Cutting') {
      await supabase.from('orders').update({ status: 'Produksi' }).eq('id', order.id);
      this.orders.update((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status: 'Produksi' } : o)),
      );
    }

    this.saving.set(false);
    this.batches.update((list) => [batch, ...list]);
    this.panelMovements.update((list) => [
      ...list,
      { material_id: null, order_id: order.id, qty_masuk: 0, qty_keluar: qtyInt },
    ]);
    this.bahanMovements.update((list) => [
      ...list,
      ...accessories.map((acc) => ({
        material_id: acc.material_id,
        order_id: order.id,
        qty_masuk: 0,
        qty_keluar: Number(acc.kebutuhan_per_pcs) * qtyInt,
      })),
    ]);
    if (movErr) {
      this.errorMsg.set('Produksi tersimpan, tapi mutasi stok gagal: ' + movErr.message);
      return;
    }
    this.errorMsg.set('');

    this.fQty.set('');
    this.fCatatan.set('');

    animate('.production-form-panel', {
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
