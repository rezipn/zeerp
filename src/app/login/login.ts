import { AfterViewInit, Component, ElementRef, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { animate, stagger } from 'animejs';
import { supabase } from '../supabase';

@Component({
  imports: [FormsModule],
  selector: 'app-login',
  styleUrl: './login.scss',
  templateUrl: './login.html',
})
export class Login implements AfterViewInit, OnDestroy {
  private router = inject(Router);
  private host = inject(ElementRef) as ElementRef<HTMLElement>;

  email = '';
  password = '';
  loading = signal(false);
  errorMessage = signal('');
  passwordFocused = signal(false);
  showPassword = signal(false);
  success = signal(false);

  private onMouseMove = (event: MouseEvent) => {
    const chars = this.host.nativeElement.querySelectorAll('.char') as NodeListOf<SVGGElement>;
    chars.forEach((char: SVGGElement) => {
      const face = char.querySelector('.face');
      if (!face) return;
      const rect = face.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(3.2, Math.hypot(dx, dy) / 60);
      const px = Math.cos(angle) * dist;
      const py = Math.sin(angle) * dist;
      const pupils = char.querySelectorAll('.pupil') as NodeListOf<SVGCircleElement>;
      pupils.forEach((pupil: SVGCircleElement) => {
        pupil.style.transform = `translate(${px}px, ${py}px)`;
      });
    });
  };

  ngAfterViewInit() {
    animate('.char', {
      y: [28, 0],
      opacity: [0, 1],
      duration: 750,
      delay: stagger(95),
      ease: 'outElastic(1, .6)',
    });

    animate('.char-body', {
      y: [0, -5],
      duration: 1800,
      delay: stagger(240),
      ease: 'inOutSine',
      loop: true,
      alternate: true,
    });

    animate('.eye', {
      scaleY: [1, 0.08, 1],
      duration: 150,
      delay: stagger(80),
      ease: 'inOutQuad',
      loop: true,
      loopDelay: 3000,
    });

    window.addEventListener('mousemove', this.onMouseMove);
  }

  ngOnDestroy() {
    window.removeEventListener('mousemove', this.onMouseMove);
  }

  togglePassword() {
    this.showPassword.update((v) => !v);
  }

  async onLogin() {
    this.loading.set(true);
    this.errorMessage.set('');

    const { error } = await supabase.auth.signInWithPassword({
      email: this.email,
      password: this.password,
    });

    this.loading.set(false);

    if (error) {
      this.errorMessage.set('Email atau password salah. Coba lagi ya.');
      return;
    }

    this.success.set(true);
    animate('.char', {
      y: [0, -16, 0],
      duration: 480,
      delay: stagger(70),
      ease: 'outQuad',
    });
    setTimeout(() => this.router.navigate(['/dashboard']), 720);
  }
}