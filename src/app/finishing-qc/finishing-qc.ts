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

interface QcRow {
  id: string;
  tanggal: string;
  order_id: string;
  qty_lulus: number;
  qty_reject: number;
  qty_repair: number;
  alasan_reject: string | null;
  catatan: string | null;
  created_at: string;
  orders: OrderRef | null;
}

interface MovementSum {
  order_id: string | null;
  qty_masuk: number;
  qty_keluar: number;
}

@Component({
  imports: [Loader],
  selector: 'app-finishing-qc',
  styleUrl: './finishing-qc.scss',
  templateUrl: './finishing-qc.html',
})
export class FinishingQc implements OnInit {
  batches = signal<QcRow[]>([]);
  orders = signal<OrderRef[]>([]);
  wipMovements = signal<MovementSum[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  showForm = signal(false);
  saving = signal(false);
  fTanggal = signal(new Date().toLocaleDateString('en-CA'));
  fOrderId = signal('');
  fLulus = signal('');
  fReject = signal('');
  fRepair = signal('');
  fAlasan = signal('');
  fCatatan = signal('');

  wipStock = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.wipMovements()) {
      if (!m.order_id) continue;
      map.set(m.order_id, (map.get(m.order_id) ?? 0) + Number(m.qty_masuk) - Number(m.qty_keluar));
    }
    return map;
  });

  wipRows = computed(() =>
    this.orders()
      .filter((o) => this.wipStock().has(o.id))
      .map((o) => ({ ...o, wip: this.wipStock().get(o.id) ?? 0 })),
  );

  selectedOrder = computed(() => this.orders().find((o) => o.id === this.fOrderId()) ?? null);

  wipAvailable = computed(() => {
    const id = this.fOrderId();
    return id ? (this.wipStock().get(id) ?? 0) : null;
  });

  async ngOnInit() {
    const [batchesRes, ordersRes, wipRes] = await Promise.all([
      supabase
        .from('qc_batches')
        .select('*, orders(no_order, style_id, status, styles(kode, nama))')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, no_order, style_id, status, styles(kode, nama)')
        .order('created_at', { ascending: false }),
      supabase.from('stock_movements').select('order_id, qty_masuk, qty_keluar').eq('jenis', 'wip'),
    ]);

    if (batchesRes.error || ordersRes.error || wipRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' +
          (batchesRes.error?.message ?? ordersRes.error?.message ?? wipRes.error?.message),
      );
      this.loading.set(false);
      return;
    }

    this.batches.set((batchesRes.data ?? []) as QcRow[]);
    this.orders.set((ordersRes.data ?? []) as unknown as OrderRef[]);
    this.wipMovements.set((wipRes.data ?? []) as MovementSum[]);
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
    if (!document.querySelector('.qc-form-panel')) return;
    animate('.qc-form-panel', {
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

  async addQc() {
    const order = this.selectedOrder();
    const lulus = Math.round(this.parseNum(this.fLulus()) ?? 0);
    const reject = Math.round(this.parseNum(this.fReject()) ?? 0);
    const repair = Math.round(this.parseNum(this.fRepair()) ?? 0);
    if (!order || (lulus <= 0 && reject <= 0 && repair <= 0)) return;
    const available = this.wipAvailable() ?? 0;
    if (lulus + reject > available) {
      this.errorMsg.set(
        `Lulus + reject (${this.formatNum(lulus + reject)}) melebihi WIP order ini (${this.formatNum(available)} pcs).`,
      );
      return;
    }
    this.saving.set(true);

    const { data, error } = await supabase
      .from('qc_batches')
      .insert({
        tanggal: this.fTanggal(),
        order_id: order.id,
        qty_lulus: lulus,
        qty_reject: reject,
        qty_repair: repair,
        alasan_reject: this.fAlasan().trim() || null,
        catatan: this.fCatatan().trim() || null,
      })
      .select('*, orders(no_order, style_id, status, styles(kode, nama))')
      .single();

    if (error) {
      this.saving.set(false);
      this.errorMsg.set('Gagal menyimpan QC: ' + error.message);
      return;
    }

    const batch = data as QcRow;
    const movements: Record<string, unknown>[] = [];
    if (lulus + reject > 0) {
      movements.push({
        tanggal: this.fTanggal(),
        jenis: 'wip',
        material_id: null,
        order_id: order.id,
        gudang_asal: 'Produksi',
        qty_masuk: 0,
        qty_keluar: lulus + reject,
        sumber_transaksi: 'qc',
        ref_id: batch.id,
        catatan: this.fCatatan().trim() || null,
      });
    }
    if (lulus > 0) {
      movements.push({
        tanggal: this.fTanggal(),
        jenis: 'fg',
        material_id: null,
        order_id: order.id,
        gudang_tujuan: 'Gudang FG',
        qty_masuk: lulus,
        qty_keluar: 0,
        sumber_transaksi: 'qc',
        ref_id: batch.id,
        catatan: null,
      });
    }
    if (reject > 0) {
      movements.push({
        tanggal: this.fTanggal(),
        jenis: 'sisa',
        material_id: null,
        order_id: order.id,
        gudang_tujuan: 'Gudang Barang Sisa',
        qty_masuk: reject,
        qty_keluar: 0,
        sumber_transaksi: 'qc',
        ref_id: batch.id,
        catatan: this.fAlasan().trim() || null,
      });
    }

    let movErr: { message: string } | null = null;
    if (movements.length > 0) {
      const res = await supabase.from('stock_movements').insert(movements);
      movErr = res.error;
    }

    if (['Baru', 'Cutting', 'Produksi'].includes(order.status)) {
      await supabase.from('orders').update({ status: 'Finishing' }).eq('id', order.id);
      this.orders.update((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status: 'Finishing' } : o)),
      );
    }

    this.saving.set(false);
    this.batches.update((list) => [batch, ...list]);
    if (lulus + reject > 0) {
      this.wipMovements.update((list) => [
        ...list,
        { order_id: order.id, qty_masuk: 0, qty_keluar: lulus + reject },
      ]);
    }
    if (movErr) {
      this.errorMsg.set('QC tersimpan, tapi mutasi stok gagal: ' + movErr.message);
      return;
    }
    this.errorMsg.set('');

    this.fLulus.set('');
    this.fReject.set('');
    this.fRepair.set('');
    this.fAlasan.set('');
    this.fCatatan.set('');

    animate('.qc-form-panel', {
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
