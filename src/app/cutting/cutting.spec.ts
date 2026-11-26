import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Cutting } from './cutting';

describe('Cutting', () => {
  let component: Cutting;
  let fixture: ComponentFixture<Cutting>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cutting],
    }).compileComponents();

    fixture = TestBed.createComponent(Cutting);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
