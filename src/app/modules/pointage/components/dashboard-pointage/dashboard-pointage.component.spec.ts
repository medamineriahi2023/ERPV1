import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardPointageComponent } from './dashboard-pointage.component';

describe('DashboardPointageComponent', () => {
  let component: DashboardPointageComponent;
  let fixture: ComponentFixture<DashboardPointageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPointageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardPointageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
