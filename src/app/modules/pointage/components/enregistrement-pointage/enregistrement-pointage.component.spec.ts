import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnregistrementPointageComponent } from './enregistrement-pointage.component';

describe('EnregistrementPointageComponent', () => {
  let component: EnregistrementPointageComponent;
  let fixture: ComponentFixture<EnregistrementPointageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnregistrementPointageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EnregistrementPointageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
