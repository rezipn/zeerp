import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MaterialStock } from './material-stock';

describe('MaterialStock', () => {
  let component: MaterialStock;
  let fixture: ComponentFixture<MaterialStock>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MaterialStock],
    }).compileComponents();

    fixture = TestBed.createComponent(MaterialStock);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
