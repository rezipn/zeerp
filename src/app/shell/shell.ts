import { AfterViewInit, Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { animate, stagger } from 'animejs';
import { supabase } from '../supabase';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-shell',
  styleUrl: './shell.scss',
  templateUrl: './shell.html',
})
export class Shell implements OnInit, AfterViewInit {
  private router = inject(Router);

  userEmail = signal('');
  sidebarOpen = signal(false);
  masterOpen = signal(true);
  opsOpen = signal(true);

  async ngOnInit() {
    const { data } = await supabase.auth.getSession();
    this.userEmail.set(data.session?.user.email ?? '');
  }

  ngAfterViewInit() {
    animate('.nav-item', {
      y: [10, 0],
      opacity: [0, 1],
      duration: 420,
      delay: stagger(45),
      ease: 'outQuad',
    });
  }

  toggleSidebar() {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }

  async onLogout() {
    await supabase.auth.signOut();
    this.router.navigate(['/login']);
  }
}