import { Component, OnInit, computed, signal } from '@angular/core';
import { supabase } from '../supabase';
import { Loader } from '../loader/loader';
import { animate } from 'animejs';

interface Material {
  id: string;
  kode: string;
  nama: string;
  jenis: string | null;
  satuan: string;
  stok_minimum: number;
}

interface MovementRow {
  id: string;
  tanggal: string;
  material_id: string;
  qty_masuk: number;
  qty_keluar: number;
  sumber_transaksi: string | null;
  gudang_asal: string | null;
  gudang_tujuan: string | null;
  catatan: string | null;
  created_at: string;
}

@Component({
  imports: [Loader],
  selector: 'app-material-stock',
  styleUrl: './material-stock.scss',
  templateUrl: './material-stock.html',
})
export class MaterialStock implements OnInit {
  materials = signal<Material[]>([]);
  movements = signal<MovementRow[]>([]);
  loading = signal(true);
  errorMsg = signal('');
  selectedMaterialId = signal<string | null>(null);

  stockRows = computed(() => {
    const sums = new Map<string, number>();
    for (const m of this.movements()) {
      sums.set(
        m.material_id,
        (sums.get(m.material_id) ?? 0) + Number(m.qty_masuk) - Number(m.qty_keluar)
      );
    }
    return this.materials().map((mat) => ({ ...mat, stok: sums.get(mat.id) ?? 0 }));
  });

  selectedMaterial = computed(
    () => this.materials().find((m) => m.id === this.selectedMaterialId()) ?? null
  );

  cardRows = computed(() => {
    const id = this.selectedMaterialId();
    if (!id) return [];
    const rows = this.movements()
      .filter((m) => m.material_id === id)
      .sort((a, b) => (a.tanggal + a.created_at).localeCompare(b.tanggal + b.created_at));
    let saldo = 0;
    const withSaldo = rows.map((m) => {
      saldo += Number(m.qty_masuk) - Number(m.qty_keluar);
      return { ...m, saldo };
    });
    return withSaldo.reverse();
  });

  async ngOnInit() {
    const [materialsRes, movementsRes] = await Promise.all([
      supabase
        .from('materials')
        .select('id, kode, nama, jenis, satuan, stok_minimum')
        .order('kode'),
      supabase
        .from('stock_movements')
        .select('*')
        .eq('jenis', 'bahan')
        .order('created_at', { ascending: false }),
    ]);

    if (materialsRes.error || movementsRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' + (materialsRes.error?.message ?? movementsRes.error?.message)
      );
      this.loading.set(false);
      return;
    }

    this.materials.set(materialsRes.data ?? []);
    this.movements.set((movementsRes.data ?? []) as MovementRow[]);
    this.loading.set(false);
  }

  selectMaterial(id: string) {
    this.selectedMaterialId.set(id);
    requestAnimationFrame(() => {
      if (document.querySelector('.stock-card-panel')) {
        animate('.stock-card-panel', { opacity: [0.4, 1], y: [6, 0], duration: 300, ease: 'outQuad' });
      }
    });
  }

  formatNum(n: number | null): string {
    if (n === null || n === undefined) return '';
    return Number(n).toLocaleString('id-ID', { maximumFractionDigits: 4 });
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
    const map: Record<string, string> = {
      barang_masuk: 'Barang Masuk',
      cutting: 'Cutting',
      produksi: 'Produksi',
      finishing: 'Finishing',
      koreksi: 'Koreksi',
    };
    return s ? (map[s] ?? s) : '-';
  }
}