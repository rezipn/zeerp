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

interface SisaMovement {
  id: string;
  tanggal: string;
  order_id: string | null;
  qty_masuk: number;
  qty_keluar: number;
  sumber_transaksi: string | null;
  catatan: string | null;
  created_at: string;
  orders: OrderRef | null;
}

@Component({
  imports: [Loader],
  selector: 'app-leftover',
  styleUrl: './leftover.scss',
  templateUrl: './leftover.html',
})
export class Leftover implements OnInit {
  movements = signal<SisaMovement[]>([]);
  orders = signal<OrderRef[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  showForm = signal(false);
  saving = signal(false);
  fTanggal = signal(new Date().toLocaleDateString('en-CA'));
  fOrderId = signal('');
  fQty = signal('');
  fKeterangan = signal('');

  sisaStock = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.movements()) {
      if (!m.order_id) continue;
      map.set(m.order_id, (map.get(m.order_id) ?? 0) + Number(m.qty_masuk) - Number(m.qty_keluar));
    }
    return map;
  });

  sisaRows = computed(() =>
    this.orders()
      .filter((o) => this.sisaStock().has(o.id))
      .map((o) => ({ ...o, sisa: this.sisaStock().get(o.id) ?? 0 })),
  );

  sisaAvailable = computed(() => {
    const id = this.fOrderId();
    return id ? (this.sisaStock().get(id) ?? 0) : null;
  });

  async ngOnInit() {
    const [movRes, ordersRes] = await Promise.all([
      supabase
        .from('stock_movements')
        .select('*, orders(no_order, style_id, status, styles(kode, nama))')
        .eq('jenis', 'sisa')
        .order('created_at', { ascending: false }),
      supabase
        .from('orders')
        .select('id, no_order, style_id, status, styles(kode, nama)')
        .order('created_at', { ascending: false }),
    ]);

    if (movRes.error || ordersRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' + (movRes.error?.message ?? ordersRes.error?.message),
      );
      this.loading.set(false);
      return;
    }

    this.movements.set((movRes.data ?? []) as SisaMovement[]);
    this.orders.set((ordersRes.data ?? []) as unknown as OrderRef[]);
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
    if (!document.querySelector('.sisa-form-panel')) return;
    animate('.sisa-form-panel', {
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

  isPositive(n: number): boolean {
    return Number(n) > 0;
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

  sumberLabel(s: string | null): string {
    if (s === 'qc') return 'Reject QC';
    if (s === 'pengeluaran_sisa') return 'Pengeluaran';
    return s ?? '-';
  }

  async addOut() {
    const qty = this.parseNum(this.fQty());
    if (!this.fOrderId() || !qty || qty <= 0) return;
    const qtyInt = Math.round(qty);
    const available = this.sisaAvailable() ?? 0;
    if (qtyInt > available) {
      this.errorMsg.set(
        `Qty keluar (${this.formatNum(qtyInt)}) melebihi stok sisa order ini (${this.formatNum(available)} pcs).`,
      );
      return;
    }
    this.saving.set(true);

    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        tanggal: this.fTanggal(),
        jenis: 'sisa',
        material_id: null,
        order_id: this.fOrderId(),
        gudang_asal: 'Gudang Barang Sisa',
        qty_masuk: 0,
        qty_keluar: qtyInt,
        sumber_transaksi: 'pengeluaran_sisa',
        catatan: this.fKeterangan().trim() || null,
      })
      .select('*, orders(no_order, style_id, status, styles(kode, nama))')
      .single();

    this.saving.set(false);
    if (error) {
      this.errorMsg.set('Gagal menyimpan pengeluaran: ' + error.message);
      return;
    }
    this.errorMsg.set('');
    this.movements.update((list) => [data as SisaMovement, ...list]);

    this.fQty.set('');
    this.fKeterangan.set('');

    animate('.sisa-form-panel', {
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
