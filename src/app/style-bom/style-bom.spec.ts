import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StyleBom } from './style-bom';

describe('StyleBom', () => {
  let component: StyleBom;
  let fixture: ComponentFixture<StyleBom>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StyleBom],
    }).compileComponents();

    fixture = TestBed.createComponent(StyleBom);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
