import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FinishingQc } from './finishing-qc';

describe('FinishingQc', () => {
  let component: FinishingQc;
  let fixture: ComponentFixture<FinishingQc>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinishingQc],
    }).compileComponents();

    fixture = TestBed.createComponent(FinishingQc);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
