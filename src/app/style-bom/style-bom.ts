import { Component, OnInit, computed, signal } from '@angular/core';
import { supabase } from '../supabase';

interface Style {
  id: string;
  kode: string;
  nama: string;
  kategori: string | null;
  ukuran: string | null;
  target_qty: number | null;
  aktif: boolean;
}

interface Material {
  id: string;
  kode: string;
  nama: string;
  jenis: string | null;
  warna: string | null;
  satuan: string;
  klasifikasi: string | null;
  supplier: string | null;
  stok_minimum: number;
  aktif: boolean;
}

interface BomItem {
  id: string;
  style_id: string;
  material_id: string;
  kebutuhan_per_pcs: number | null;
  materials: Material;
}

@Component({
  imports: [],
  selector: 'app-style-bom',
  styleUrl: './style-bom.scss',
  templateUrl: './style-bom.html',
})
export class StyleBom implements OnInit {
  styles = signal<Style[]>([]);
  bomItems = signal<BomItem[]>([]);
  selectedStyleId = signal<string | null>(null);
  loading = signal(true);
  errorMsg = signal('');

  selectedStyle = computed(
    () => this.styles().find((s) => s.id === this.selectedStyleId()) ?? null
  );

  selectedBom = computed(() =>
    this.bomItems()
      .filter((b) => b.style_id === this.selectedStyleId())
      .sort((a, b) => a.materials.kode.localeCompare(b.materials.kode))
  );

  async ngOnInit() {
    const [stylesRes, bomRes] = await Promise.all([
      supabase.from('styles').select('*').order('kode'),
      supabase.from('bom_items').select('*, materials(*)'),
    ]);

    if (stylesRes.error || bomRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' + (stylesRes.error?.message ?? bomRes.error?.message)
      );
      this.loading.set(false);
      return;
    }

    this.styles.set(stylesRes.data ?? []);
    this.bomItems.set((bomRes.data ?? []) as BomItem[]);
    if (this.styles().length > 0) {
      this.selectedStyleId.set(this.styles()[0].id);
    }
    this.loading.set(false);
  }

  selectStyle(id: string) {
    this.selectedStyleId.set(id);
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

  onKebutuhanInput(event: Event) {
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

  async onKebutuhanChange(item: BomItem, event: Event) {
    const input = event.target as HTMLInputElement;
    const num = this.parseNum(input.value);
    const { error } = await supabase
      .from('bom_items')
      .update({ kebutuhan_per_pcs: num })
      .eq('id', item.id);
    if (error) {
      this.errorMsg.set('Gagal menyimpan kebutuhan: ' + error.message);
      return;
    }
    this.errorMsg.set('');
    this.bomItems.update((list) =>
      list.map((b) => (b.id === item.id ? { ...b, kebutuhan_per_pcs: num } : b))
    );
    input.value = this.formatNum(num);
  }
}