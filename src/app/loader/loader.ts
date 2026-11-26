import { AfterViewInit, Component, ElementRef, OnDestroy, input, viewChild } from '@angular/core';
import lottie, { AnimationItem } from 'lottie-web';

@Component({
  imports: [],
  selector: 'app-loader',
  styleUrl: './loader.scss',
  templateUrl: './loader.html',
})
export class Loader implements AfterViewInit, OnDestroy {
  size = input(120);
  private box = viewChild.required<ElementRef<HTMLDivElement>>('box');
  private anim: AnimationItem | null = null;

  ngAfterViewInit() {
    this.anim = lottie.loadAnimation({
      container: this.box().nativeElement,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: 'animations/loading.json',
    });
  }

  ngOnDestroy() {
    this.anim?.destroy();
  }
}