import { Component, HostListener, OnInit, computed, signal } from '@angular/core';
import { supabase } from '../supabase';
import { Loader } from '../loader/loader';
import { animate, stagger } from 'animejs';
import * as echarts from 'echarts';

interface OrderRef {
  id: string;
  no_order: string;
  qty_order: number;
  status: string;
  target_selesai: string | null;
  styles: { kode: string; nama: string } | null;
  buyers: { nama: string } | null;
}

interface Movement {
  id: string;
  tanggal: string;
  jenis: string;
  material_id: string | null;
  order_id: string | null;
  qty_masuk: number;
  qty_keluar: number;
  sumber_transaksi: string | null;
  created_at: string;
  materials: { kode: string; nama: string; satuan: string } | null;
  orders: { no_order: string } | null;
}

@Component({
  imports: [Loader],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  orders = signal<OrderRef[]>([]);
  movements = signal<Movement[]>([]);
  loading = signal(true);
  errorMsg = signal('');

  private charts: echarts.ECharts[] = [];

  orderAktif = computed(() => this.orders().filter((o) => o.status !== 'Selesai').length);
  orderSelesai = computed(() => this.orders().filter((o) => o.status === 'Selesai').length);

  bahanTersedia = computed(() => {
    const map = new Map<string, number>();
    for (const m of this.movements()) {
      if (m.jenis !== 'bahan' || !m.material_id) continue;
      map.set(
        m.material_id,
        (map.get(m.material_id) ?? 0) + Number(m.qty_masuk) - Number(m.qty_keluar),
      );
    }
    return [...map.values()].filter((v) => v > 0).length;
  });

  fgSiapKirim = computed(() => {
    let total = 0;
    for (const m of this.movements()) {
      if (m.jenis !== 'fg') continue;
      total += Number(m.qty_masuk) - Number(m.qty_keluar);
    }
    return total;
  });

  wipTotal = computed(() => {
    let total = 0;
    for (const m of this.movements()) {
      if (m.jenis !== 'wip') continue;
      total += Number(m.qty_masuk) - Number(m.qty_keluar);
    }
    return total;
  });

  progressRows = computed(() =>
    this.orders()
      .filter((o) => o.status !== 'Selesai')
      .map((o) => {
        let panel = 0;
        let produksi = 0;
        let fg = 0;
        let terkirim = 0;
        for (const m of this.movements()) {
          if (m.order_id !== o.id) continue;
          if (m.jenis === 'panel') panel += Number(m.qty_masuk);
          if (m.jenis === 'wip') produksi += Number(m.qty_masuk);
          if (m.jenis === 'fg') {
            fg += Number(m.qty_masuk) - Number(m.qty_keluar);
            terkirim += Number(m.qty_keluar);
          }
        }
        const target = Number(o.qty_order) || 0;
        const persen = target > 0 ? Math.min(100, Math.round((terkirim / target) * 100)) : 0;
        return { ...o, panel, produksi, fg, terkirim, persen };
      }),
  );

  recentMovements = computed(() => this.movements().slice(0, 8));

  orderPerStatus = computed(() => {
    const statuses = ['Baru', 'Cutting', 'Produksi', 'Finishing', 'Selesai'];
    return statuses
      .map((s) => ({ name: s, value: this.orders().filter((o) => o.status === s).length }))
      .filter((d) => d.value > 0);
  });

  stokBahanTop = computed(() => {
    const map = new Map<string, { kode: string; satuan: string; stok: number }>();
    for (const m of this.movements()) {
      if (m.jenis !== 'bahan' || !m.material_id || !m.materials) continue;
      const cur = map.get(m.material_id) ?? {
        kode: m.materials.kode,
        satuan: m.materials.satuan,
        stok: 0,
      };
      cur.stok += Number(m.qty_masuk) - Number(m.qty_keluar);
      map.set(m.material_id, cur);
    }
    return [...map.values()]
      .filter((d) => d.stok > 0)
      .sort((a, b) => b.stok - a.stok)
      .slice(0, 8);
  });

  mutasi7Hari = computed(() => {
    const labels: string[] = [];
    const masuk: number[] = [];
    const keluar: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-CA');
      labels.push(d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }));
      let inCount = 0;
      let outCount = 0;
      for (const m of this.movements()) {
        if (m.tanggal !== key) continue;
        if (Number(m.qty_masuk) > 0) inCount++;
        if (Number(m.qty_keluar) > 0) outCount++;
      }
      masuk.push(inCount);
      keluar.push(outCount);
    }
    return { labels, masuk, keluar };
  });

  async ngOnInit() {
    const [ordersRes, movRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, no_order, qty_order, status, target_selesai, styles(kode, nama), buyers(nama)')
        .order('created_at', { ascending: false }),
      supabase
        .from('stock_movements')
        .select('*, materials(kode, nama, satuan), orders(no_order)')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    if (ordersRes.error || movRes.error) {
      this.errorMsg.set(
        'Gagal memuat data: ' + (ordersRes.error?.message ?? movRes.error?.message),
      );
      this.loading.set(false);
      return;
    }

    this.orders.set((ordersRes.data ?? []) as unknown as OrderRef[]);
    this.movements.set((movRes.data ?? []) as Movement[]);
    this.loading.set(false);
    requestAnimationFrame(() => {
      this.animateIn();
      this.initCharts();
    });
  }

  @HostListener('window:resize')
  onResize() {
    for (const c of this.charts) c.resize();
  }

  initCharts() {
    for (const c of this.charts) c.dispose();
    this.charts = [];

    const textColor = 'rgba(242, 246, 252, 0.75)';
    const axisColor = 'rgba(255, 255, 255, 0.12)';

    const statusEl = document.getElementById('chart-status');
    if (statusEl) {
      const chart = echarts.init(statusEl);
      chart.setOption({
        animationDuration: 1200,
        animationEasing: 'cubicOut',
        tooltip: { trigger: 'item' },
        legend: { bottom: 0, textStyle: { color: textColor } },
        series: [
          {
            type: 'pie',
            radius: ['45%', '70%'],
            center: ['50%', '44%'],
            itemStyle: { borderColor: 'rgba(10, 22, 40, 0.9)', borderWidth: 2, borderRadius: 6 },
            label: { color: textColor, formatter: '{b}: {c}' },
            data: this.orderPerStatus().map((d) => ({
              ...d,
              itemStyle: {
                color:
                  d.name === 'Baru'
                    ? '#94a3b8'
                    : d.name === 'Cutting'
                      ? '#60a5fa'
                      : d.name === 'Produksi'
                        ? '#fbbf24'
                        : d.name === 'Finishing'
                          ? '#a78bfa'
                          : '#34d399',
              },
            })),
          },
        ],
      });
      this.charts.push(chart);
    }

    const stokEl = document.getElementById('chart-stok');
    if (stokEl) {
      const top = this.stokBahanTop();
      const chart = echarts.init(stokEl);
      chart.setOption({
        animationDuration: 1200,
        animationEasing: 'cubicOut',
        tooltip: { trigger: 'axis' },
        grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
        xAxis: {
          type: 'category',
          data: top.map((d) => d.kode),
          axisLabel: { color: textColor },
          axisLine: { lineStyle: { color: axisColor } },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: textColor },
          splitLine: { lineStyle: { color: axisColor } },
        },
        series: [
          {
            type: 'bar',
            data: top.map((d) => d.stok),
            itemStyle: {
              borderRadius: [6, 6, 0, 0],
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#60a5fa' },
                { offset: 1, color: '#2563eb' },
              ]),
            },
            label: { show: true, position: 'top', color: textColor },
          },
        ],
      });
      this.charts.push(chart);
    }

    const mutasiEl = document.getElementById('chart-mutasi');
    if (mutasiEl) {
      const data = this.mutasi7Hari();
      const chart = echarts.init(mutasiEl);
      chart.setOption({
        animationDuration: 1400,
        animationEasing: 'cubicOut',
        tooltip: { trigger: 'axis' },
        legend: { top: 0, textStyle: { color: textColor } },
        grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: data.labels,
          axisLabel: { color: textColor },
          axisLine: { lineStyle: { color: axisColor } },
        },
        yAxis: {
          type: 'value',
          minInterval: 1,
          axisLabel: { color: textColor },
          splitLine: { lineStyle: { color: axisColor } },
        },
        series: [
          {
            name: 'Transaksi Masuk',
            type: 'line',
            smooth: true,
            symbolSize: 8,
            data: data.masuk,
            lineStyle: { width: 3, color: '#34d399' },
            itemStyle: { color: '#34d399' },
            areaStyle: { color: 'rgba(52, 211, 153, 0.15)' },
          },
          {
            name: 'Transaksi Keluar',
            type: 'line',
            smooth: true,
            symbolSize: 8,
            data: data.keluar,
            lineStyle: { width: 3, color: '#f87171' },
            itemStyle: { color: '#f87171' },
            areaStyle: { color: 'rgba(248, 113, 113, 0.12)' },
          },
        ],
      });
      this.charts.push(chart);
    }
  }

  animateIn() {
    animate('.kpi-card', {
      opacity: [0, 1],
      y: [16, 0],
      delay: stagger(90),
      duration: 500,
      ease: 'outQuad',
    });
    animate('.progress-fill', {
      scaleX: [0, 1],
      delay: stagger(80, { start: 250 }),
      duration: 800,
      ease: 'outQuad',
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

  movementLabel(m: Movement): string {
    const qty =
      Number(m.qty_masuk) > 0
        ? `+${this.formatNum(m.qty_masuk)}`
        : `-${this.formatNum(m.qty_keluar)}`;
    if (m.jenis === 'bahan') {
      return `${qty} ${m.materials?.satuan ?? ''} ${m.materials?.kode ?? ''} ${m.materials?.nama ?? ''}`.trim();
    }
    const jenisLabel: Record<string, string> = {
      panel: 'Panel',
      wip: 'WIP',
      fg: 'Finish Good',
      sisa: 'Barang Sisa',
    };
    return `${qty} pcs ${jenisLabel[m.jenis] ?? m.jenis} ${m.orders?.no_order ?? ''}`.trim();
  }
}
