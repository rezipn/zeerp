import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Leftover } from './leftover';

describe('Leftover', () => {
  let component: Leftover;
  let fixture: ComponentFixture<Leftover>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Leftover],
    }).compileComponents();

    fixture = TestBed.createComponent(Leftover);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
