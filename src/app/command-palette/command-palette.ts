import { Component, ElementRef, HostListener, OnInit, ViewChild, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { animate } from 'animejs';

interface PaletteItem {
  label: string;
  route: string;
  group: string;
  keywords: string;
}

@Component({
  selector: 'app-command-palette',
  styleUrl: './command-palette.scss',
  templateUrl: './command-palette.html',
})
export class CommandPalette implements OnInit {
  private router = inject(Router);

  closed = output<void>();

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  query = signal('');
  selectedIndex = signal(0);

  items: PaletteItem[] = [
    { label: 'Dashboard', route: '/dashboard', group: 'Umum', keywords: 'ringkasan kpi chart home' },
    { label: 'Style & BOM', route: '/master/style-bom', group: 'Master Data', keywords: 'style bahan bom resep master' },
    { label: 'Order & Style', route: '/operasional/order', group: 'Operasional', keywords: 'order buyer pesanan' },
    { label: 'Barang Masuk', route: '/operasional/barang-masuk', group: 'Operasional', keywords: 'penerimaan supplier masuk beli' },
    { label: 'Gudang Bahan', route: '/operasional/gudang-bahan', group: 'Operasional', keywords: 'stok bahan kartu stok gudang' },
    { label: 'Cutting', route: '/operasional/cutting', group: 'Operasional', keywords: 'potong panel cutting' },
    { label: 'Produksi', route: '/operasional/produksi', group: 'Operasional', keywords: 'sewing jahit produksi wip' },
    { label: 'Finishing & QC', route: '/operasional/finishing-qc', group: 'Operasional', keywords: 'qc finishing periksa reject lulus' },
    { label: 'Gudang FG', route: '/operasional/gudang-fg', group: 'Operasional', keywords: 'finish good kirim pengiriman fg' },
    { label: 'Barang Sisa', route: '/operasional/barang-sisa', group: 'Operasional', keywords: 'sisa reject buang jual' },
  ];

  filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.items;
    return this.items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.keywords.includes(q) || i.group.toLowerCase().includes(q)
    );
  });

  ngOnInit() {
    requestAnimationFrame(() => {
      this.searchInput?.nativeElement.focus();
      animate('.palette-panel', {
        opacity: [0, 1],
        y: [-14, 0],
        scale: [0.98, 1],
        duration: 260,
        ease: 'outQuad',
      });
    });
  }

  onQuery(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
    this.selectedIndex.set(0);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent) {
    const list = this.filtered();
    if (event.key === 'Escape') {
      this.close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectedIndex.update((i) => Math.min(i + 1, list.length - 1));
      this.scrollSelected();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectedIndex.update((i) => Math.max(i - 1, 0));
      this.scrollSelected();
    } else if (event.key === 'Enter') {
      const item = list[this.selectedIndex()];
      if (item) this.go(item);
    }
  }

  scrollSelected() {
    requestAnimationFrame(() => {
      document
        .querySelector('.palette-item.selected')
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  go(item: PaletteItem) {
    this.router.navigate([item.route]);
    this.close();
  }

  close() {
    this.closed.emit();
  }
}