import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GoodsIn } from './goods-in';

describe('GoodsIn', () => {
  let component: GoodsIn;
  let fixture: ComponentFixture<GoodsIn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoodsIn],
    }).compileComponents();

    fixture = TestBed.createComponent(GoodsIn);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
