import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Dashboard } from './dashboard/dashboard';
import { Shell } from './shell/shell';
import { authGuard } from './auth-guard';
import { StyleBom } from './style-bom/style-bom';
import { Orders } from './orders/orders';
import { GoodsIn } from './goods-in/goods-in';
import { MaterialStock } from './material-stock/material-stock';
import { Cutting } from './cutting/cutting';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'master/style-bom', component: StyleBom },
      { path: 'operasional/order', component: Orders },
      { path: 'operasional/barang-masuk', component: GoodsIn },
      { path: 'operasional/gudang-bahan', component: MaterialStock },
      { path: 'operasional/cutting', component: Cutting },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];