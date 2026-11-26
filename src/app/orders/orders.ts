import { Component, OnInit, computed, signal } from '@angular/core';
import { supabase } from '../supabase';
import { Loader } from '../loader/loader';
import { animate } from 'animejs';


interface Buyer {
  id: string;
  nama: string;
}

interface StyleRef {
  id: string;
  kode: string;
  nama: string;
}

interface Order {
  id: string;
  no_order: string;
  buyer_id: string | null;
  style_id: string;
  qty_order: number;
  rincian: string | null;
  target_selesai: string | null;
  status: string;
  catatan: string | null;
  created_at: string;
  buyers: Buyer | null;
  styles: StyleRef | null;
}

@Component({
  imports: [Loader],
  selector: 'app-orders',
  styleUrl: './orders.scss',
  templateUrl: './orders.html',
})
export class Orders implements OnInit {
  orders = signal<Order[]>([]);
  buyers = signal<Buyer[]>([]);
  styles = signal<StyleRef[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  showForm = signal(false);
  saving = signal(false);
  fNoOrder = signal('');
  fBuyerId = signal('');
  fStyleId = signal('');
  fQty = signal('');
  fRincian = signal('');
  fTarget = signal('');
  fCatatan = signal('');

  nextNoOrder = computed(() => {
    const nums = this.orders()
      .map((o) => /^ORD-(\d+)$/.exec(o.no_order)?.[1])
      .filter((n): n is string => !!n)
      .map(Number);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return 'ORD-' + String(next).padStart(3, '0');
  });

  async ngOnInit() {
    const [ordersRes, buyersRes, stylesRes] = await Promise.all([
      supabase
        .from('orders')
        .select('*, buyers(nama), styles(kode, nama)')
        .order('created_at', { ascending: false }),
      supabase.from('buyers').select('id, nama').order('nama'),
      supabase.from('styles').select('id, kode, nama').order('kode'),
    ]);

    if (ordersRes.error || buyersRes.error || stylesRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' +
          (ordersRes.error?.message ?? buyersRes.error?.message ?? stylesRes.error?.message)
      );
      this.loading.set(false);
      return;
    }

    this.orders.set((ordersRes.data ?? []) as Order[]);
    this.buyers.set(buyersRes.data ?? []);
    this.styles.set(stylesRes.data ?? []);
    this.loading.set(false);
  }

  toggleForm() {
  const open = !this.showForm();
  this.showForm.set(open);
  if (open) {
    this.fNoOrder.set(this.nextNoOrder());
    requestAnimationFrame(() => this.animateFormIn());
  }
}

animateFormIn() {
  if (!document.querySelector('.order-form-panel')) return;
  animate('.order-form-panel', {
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

  async addOrder() {
    const noOrder = this.fNoOrder().trim();
    const styleId = this.fStyleId();
    const qty = this.parseNum(this.fQty());
    if (!noOrder || !styleId || !qty) return;
    this.saving.set(true);
    const { data, error } = await supabase
      .from('orders')
      .insert({
        no_order: noOrder,
        buyer_id: this.fBuyerId() || null,
        style_id: styleId,
        qty_order: Math.round(qty),
        rincian: this.fRincian().trim() || null,
        target_selesai: this.fTarget() || null,
        catatan: this.fCatatan().trim() || null,
      })
      .select('*, buyers(nama), styles(kode, nama)')
      .single();
    this.saving.set(false);
    if (error) {
      this.errorMsg.set('Gagal menambah order: ' + error.message);
      return;
    }
    this.errorMsg.set('');
    this.orders.update((list) => [data as Order, ...list]);
    this.fNoOrder.set('');
    this.fBuyerId.set('');
    this.fStyleId.set('');
    this.fQty.set('');
    this.fRincian.set('');
    this.fTarget.set('');
    this.fCatatan.set('');
    animate('.order-form-panel', {
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