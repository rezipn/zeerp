import { Component, OnInit, computed, signal } from '@angular/core';
import { supabase } from '../supabase';
import { Loader } from '../loader/loader';

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
  imports: [Loader],
  selector: 'app-style-bom',
  styleUrl: './style-bom.scss',
  templateUrl: './style-bom.html',
})
export class StyleBom implements OnInit {
  styles = signal<Style[]>([]);
  materials = signal<Material[]>([]);
  bomItems = signal<BomItem[]>([]);
  selectedStyleId = signal<string | null>(null);
  loading = signal(true);
  errorMsg = signal('');
  newMaterialId = signal('');
  newKebutuhan = signal('');
  saving = signal(false);

  showStyleForm = signal(false);
savingStyle = signal(false);
fStyleKode = signal('');
fStyleNama = signal('');
fStyleKategori = signal('');
fStyleUkuran = signal('');
fStyleTarget = signal('');

showMaterialForm = signal(false);
savingMaterial = signal(false);
fMatKode = signal('');
fMatNama = signal('');
fMatJenis = signal('Kain');
fMatWarna = signal('');
fMatSatuan = signal('meter');
fMatKlasifikasi = signal('Bahan Baku');
fMatSupplier = signal('');

  selectedStyle = computed(
    () => this.styles().find((s) => s.id === this.selectedStyleId()) ?? null
  );

  selectedBom = computed(() =>
    this.bomItems()
      .filter((b) => b.style_id === this.selectedStyleId())
      .sort((a, b) => a.materials.kode.localeCompare(b.materials.kode))
  );

  availableMaterials = computed(() => {
    const used = new Set(this.selectedBom().map((b) => b.material_id));
    return this.materials().filter((m) => !used.has(m.id));
  });

  nextMaterialKode = computed(() => {
  const nums = this.materials()
    .map((m) => /^BHN-(\d+)$/.exec(m.kode)?.[1])
    .filter((n): n is string => !!n)
    .map(Number);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return 'BHN-' + String(next).padStart(3, '0');
});

  async ngOnInit() {
    const [stylesRes, materialsRes, bomRes] = await Promise.all([
      supabase.from('styles').select('*').order('kode'),
      supabase.from('materials').select('*').order('kode'),
      supabase.from('bom_items').select('*, materials(*)'),
    ]);

    if (stylesRes.error || materialsRes.error || bomRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' +
          (stylesRes.error?.message ?? materialsRes.error?.message ?? bomRes.error?.message)
      );
      this.loading.set(false);
      return;
    }

    this.styles.set(stylesRes.data ?? []);
    this.materials.set(materialsRes.data ?? []);
    this.bomItems.set((bomRes.data ?? []) as BomItem[]);
    if (this.styles().length > 0) {
      this.selectedStyleId.set(this.styles()[0].id);
    }
    this.loading.set(false);
  }

  selectStyle(id: string) {
    this.selectedStyleId.set(id);
    this.newMaterialId.set('');
    this.newKebutuhan.set('');
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

  async addStyle() {
  const kode = this.fStyleKode().trim();
  const nama = this.fStyleNama().trim();
  if (!kode || !nama) return;
  this.savingStyle.set(true);
  const { data, error } = await supabase
    .from('styles')
    .insert({
      kode,
      nama,
      kategori: this.fStyleKategori().trim() || null,
      ukuran: this.fStyleUkuran().trim() || null,
      target_qty: this.parseNum(this.fStyleTarget()),
    })
    .select('*')
    .single();
  this.savingStyle.set(false);
  if (error) {
    this.errorMsg.set('Gagal menambah style: ' + error.message);
    return;
  }
  this.errorMsg.set('');
  const newStyle = data as Style;
  this.styles.update((list) =>
    [...list, newStyle].sort((a, b) => a.kode.localeCompare(b.kode))
  );
  this.selectStyle(newStyle.id);
  this.fStyleKode.set('');
  this.fStyleNama.set('');
  this.fStyleKategori.set('');
  this.fStyleUkuran.set('');
  this.fStyleTarget.set('');
  this.showStyleForm.set(false);
}

  toggleMaterialForm() {
  const open = !this.showMaterialForm();
  this.showMaterialForm.set(open);
  if (open) this.fMatKode.set(this.nextMaterialKode());
}

async addMaterial() {
  const kode = this.fMatKode().trim();
  const nama = this.fMatNama().trim();
  if (!kode || !nama) return;
  this.savingMaterial.set(true);
  const { data, error } = await supabase
    .from('materials')
    .insert({
      kode,
      nama,
      jenis: this.fMatJenis() || null,
      warna: this.fMatWarna().trim() || null,
      satuan: this.fMatSatuan(),
      klasifikasi: this.fMatKlasifikasi() || null,
      supplier: this.fMatSupplier().trim() || null,
    })
    .select('*')
    .single();
  this.savingMaterial.set(false);
  if (error) {
    this.errorMsg.set('Gagal menambah bahan: ' + error.message);
    return;
  }
  this.errorMsg.set('');
  const newMat = data as Material;
  this.materials.update((list) =>
    [...list, newMat].sort((a, b) => a.kode.localeCompare(b.kode))
  );
  this.newMaterialId.set(newMat.id);
  this.fMatNama.set('');
  this.fMatWarna.set('');
  this.fMatSupplier.set('');
  this.fMatKode.set(this.nextMaterialKode());
  this.showMaterialForm.set(false);
}

  async addBomItem() {
    const styleId = this.selectedStyleId();
    const materialId = this.newMaterialId();
    if (!styleId || !materialId) return;
    this.saving.set(true);
    const { data, error } = await supabase
      .from('bom_items')
      .insert({
        style_id: styleId,
        material_id: materialId,
        kebutuhan_per_pcs: this.parseNum(this.newKebutuhan()),
      })
      .select('*, materials(*)')
      .single();
    this.saving.set(false);
    if (error) {
      this.errorMsg.set('Gagal menambah bahan: ' + error.message);
      return;
    }
    this.errorMsg.set('');
    this.bomItems.update((list) => [...list, data as BomItem]);
    this.newMaterialId.set('');
    this.newKebutuhan.set('');
  }

  async removeBomItem(item: BomItem) {
    const { error } = await supabase.from('bom_items').delete().eq('id', item.id);
    if (error) {
      this.errorMsg.set('Gagal menghapus bahan: ' + error.message);
      return;
    }
    this.errorMsg.set('');
    this.bomItems.update((list) => list.filter((b) => b.id !== item.id));
  }
}