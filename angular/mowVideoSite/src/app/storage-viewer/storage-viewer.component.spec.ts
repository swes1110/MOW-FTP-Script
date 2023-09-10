import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StorageViewerComponent } from './storage-viewer.component';

describe('StorageViewerComponent', () => {
  let component: StorageViewerComponent;
  let fixture: ComponentFixture<StorageViewerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [StorageViewerComponent]
    });
    fixture = TestBed.createComponent(StorageViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
