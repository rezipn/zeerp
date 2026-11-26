import { Routes } from '@angular/router';
import { Login } from './login/login';
import { Dashboard } from './dashboard/dashboard';
import { Shell } from './shell/shell';
import { StyleBom } from './style-bom/style-bom';
import { authGuard } from './auth-guard';

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
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];