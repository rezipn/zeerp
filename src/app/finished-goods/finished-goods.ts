import { Component, OnInit, computed, signal } from '@angular/core';
import { supabase } from '../supabase';
import { Loader } from '../loader/loader';
import { animate } from 'animejs';

interface OrderRef {
  id: string;
  no_order: string;
  style_id: string;
  qty_order: number;
  status: string;
  styles: { kode: string; nama: string } | null;
  buyers: { nama: string } | null;
}

interface ShipmentRow {
  id: string;
  tanggal: string;
  order_id: string;
  qty_kirim: number;
  tujuan: string | null;
  ref_dokumen: string | null;
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
  selector: 'app-finished-goods',
  styleUrl: './finished-goods.scss',
  templateUrl: './finished-goods.html',
})
export class FinishedGoods implements OnInit {
  shipments = signal<ShipmentRow[]>([]);
  orders = signal<OrderRef[]>([]);
  fgMovements = signal<MovementSum[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  showForm = signal(false);
  saving = signal(false);
  fTanggal = signal(new Date().toLocaleDateString('en-CA'));
  fOrderId = signal('');
  fQty = signal('');
  fTujuan = signal('');
  fRefDokumen = signal('');
  fCatatan = signal('');

  fgStock = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.fgMovements()) {
      if (!m.order_id) continue;
      map.set(m.order_id, (map.get(m.order_id) ?? 0) + Number(m.qty_masuk) - Number(m.qty_keluar));
    }
    return map;
  });

  shippedTotal = computed(() => {
    const map = new Map<string, number>();
    for (const s of this.shipments()) {
      map.set(s.order_id, (map.get(s.order_id) ?? 0) + Number(s.qty_kirim));
    }
    return map;
  });

  fgRows = computed(() =>
    this.orders()
      .filter((o) => this.fgStock().has(o.id))
      .map((o) => ({
        ...o,
        fg: this.fgStock().get(o.id) ?? 0,
        terkirim: this.shippedTotal().get(o.id) ?? 0,
      })),
  );

  selectedOrder = computed(() => this.orders().find((o) => o.id === this.fOrderId()) ?? null);

  fgAvailable = computed(() => {
    const id = this.fOrderId();
    return id ? (this.fgStock().get(id) ?? 0) : null;
  });

  async ngOnInit() {
    const [shipmentsRes, ordersRes, fgRes] = await Promise.all([
      supabase
        .from('shipments')
        .select(
          '*, orders(no_order, style_id, qty_order, status, styles(kode, nama), buyers(nama))',
        )
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, no_order, style_id, qty_order, status, styles(kode, nama), buyers(nama)')
        .order('created_at', { ascending: false }),
      supabase.from('stock_movements').select('order_id, qty_masuk, qty_keluar').eq('jenis', 'fg'),
    ]);

    if (shipmentsRes.error || ordersRes.error || fgRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' +
          (shipmentsRes.error?.message ?? ordersRes.error?.message ?? fgRes.error?.message),
      );
      this.loading.set(false);
      return;
    }

    this.shipments.set((shipmentsRes.data ?? []) as ShipmentRow[]);
    this.orders.set((ordersRes.data ?? []) as unknown as OrderRef[]);
    this.fgMovements.set((fgRes.data ?? []) as MovementSum[]);
    this.loading.set(false);
  }

  toggleForm() {
    const open = !this.showForm();
    this.showForm.set(open);
    if (open) requestAnimationFrame(() => this.animateFormIn());
  }

  pickOrder(id: string) {
    this.fOrderId.set(id);
    const order = this.orders().find((o) => o.id === id);
    if (order?.buyers?.nama && !this.fTujuan()) {
      this.fTujuan.set(order.buyers.nama);
    }
    if (!this.showForm()) {
      this.showForm.set(true);
      requestAnimationFrame(() => this.animateFormIn());
    }
  }

  animateFormIn() {
    if (!document.querySelector('.shipment-form-panel')) return;
    animate('.shipment-form-panel', {
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

  async addShipment() {
    const order = this.selectedOrder();
    const qty = this.parseNum(this.fQty());
    if (!order || !qty || qty <= 0) return;
    const qtyInt = Math.round(qty);
    const available = this.fgAvailable() ?? 0;
    if (qtyInt > available) {
      this.errorMsg.set(
        `Qty kirim (${this.formatNum(qtyInt)}) melebihi stok FG order ini (${this.formatNum(available)} pcs).`,
      );
      return;
    }
    this.saving.set(true);

    const { data, error } = await supabase
      .from('shipments')
      .insert({
        tanggal: this.fTanggal(),
        order_id: order.id,
        qty_kirim: qtyInt,
        tujuan: this.fTujuan().trim() || null,
        ref_dokumen: this.fRefDokumen().trim() || null,
        catatan: this.fCatatan().trim() || null,
      })
      .select('*, orders(no_order, style_id, qty_order, status, styles(kode, nama), buyers(nama))')
      .single();

    if (error) {
      this.saving.set(false);
      this.errorMsg.set('Gagal menyimpan pengiriman: ' + error.message);
      return;
    }

    const shipment = data as ShipmentRow;
    const { error: movErr } = await supabase.from('stock_movements').insert({
      tanggal: this.fTanggal(),
      jenis: 'fg',
      material_id: null,
      order_id: order.id,
      gudang_asal: 'Gudang FG',
      qty_masuk: 0,
      qty_keluar: qtyInt,
      sumber_transaksi: 'pengiriman',
      ref_id: shipment.id,
      catatan: this.fRefDokumen().trim() || null,
    });

    const totalShipped = (this.shippedTotal().get(order.id) ?? 0) + qtyInt;
    if (totalShipped >= Number(order.qty_order)) {
      await supabase.from('orders').update({ status: 'Selesai' }).eq('id', order.id);
      this.orders.update((list) =>
        list.map((o) => (o.id === order.id ? { ...o, status: 'Selesai' } : o)),
      );
    }

    this.saving.set(false);
    this.shipments.update((list) => [shipment, ...list]);
    this.fgMovements.update((list) => [
      ...list,
      { order_id: order.id, qty_masuk: 0, qty_keluar: qtyInt },
    ]);
    if (movErr) {
      this.errorMsg.set('Pengiriman tersimpan, tapi mutasi stok gagal: ' + movErr.message);
      return;
    }
    this.errorMsg.set('');

    this.fQty.set('');
    this.fRefDokumen.set('');
    this.fCatatan.set('');

    animate('.shipment-form-panel', {
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
