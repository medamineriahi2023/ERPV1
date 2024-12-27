import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TextareaModule } from 'primeng/textarea';
import { RatingModule } from 'primeng/rating';
import { TimelineModule } from 'primeng/timeline';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { DividerModule } from 'primeng/divider';
import { ProgressBarModule } from 'primeng/progressbar';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { Employee, PerformanceReview } from '../../interfaces/employee.interface';
import { MockPerformanceReviewService } from '../../services/mock-performance-review.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Router } from '@angular/router';

interface MetricItem {
  category: string;
  weight: number;
  score: number;
  comments: string;
}

@Component({
  selector: 'app-performance-review',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    ChartModule,
    TextareaModule,
    RatingModule,
    TimelineModule,
    ToastModule,
    DividerModule,
    ProgressBarModule,
    DropdownModule,
    DialogModule,
    TableModule
  ],
  templateUrl: './performance-review.component.html',
  providers: [MessageService, MockPerformanceReviewService]
})
export class PerformanceReviewComponent implements OnInit {
  reviewForm!: FormGroup;
  metricsArray!: FormArray;
  
  loading = signal(false);
  submitted = signal(false);
  showReviewForm = signal(false);
  
  metrics = signal<MetricItem[]>([
    { category: 'Performance technique', weight: 0.4, score: 0, comments: '' },
    { category: 'Communication', weight: 0.3, score: 0, comments: '' },
    { category: 'Leadership', weight: 0.15, score: 0, comments: '' },
    { category: 'Travail d\'équipe', weight: 0.15, score: 0, comments: '' }
  ]);

  currentScore = signal(0);
  selectedEmployee = signal<Employee | null>(null);
  eligibleEmployees = signal<Employee[]>([]);
  employeeReviews = signal<PerformanceReview[]>([]);
  showHistory = signal(false);

  // Use a computed signal for the overall score
  overallScore = computed(() => this.currentScore());

  constructor(
    private fb: FormBuilder,
    private messageService: MessageService,
    private reviewService: MockPerformanceReviewService,
    public authService: AuthService,
    private router: Router
  ) {
    // Check if user is logged in and is a manager
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    if (!this.authService.isManager()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Accès refusé',
        detail: 'Vous n\'avez pas les droits pour accéder à cette page'
      });
      this.router.navigate(['/']);
      return;
    }

    this.initializeForm();
  }

  private initializeForm(): void {
    this.reviewForm = this.fb.group({
      metrics: this.fb.array([])
    });
    this.metricsArray = this.reviewForm.get('metrics') as FormArray;
  }

  ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadEligibleEmployees();
  }

  private loadEligibleEmployees() {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.loading.set(true);
    
    this.reviewService.getEligibleEmployees(currentUser.id).subscribe({
      next: (employees) => {
        const managedEmployees = this.filterEmployees(employees);
        this.eligibleEmployees.set(managedEmployees);
        this.loading.set(false);
      },
      error: (error) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible de charger la liste des employés'
        });
        this.loading.set(false);
      }
    });
  }

  private filterEmployees(employees: Employee[]): Employee[] {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return [];

    return employees.filter(emp => 
      currentUser.role === 'admin' || 
      (currentUser.role === 'manager' && currentUser.managedEmployees.includes(emp.id))
    );
  }

  onEmployeeSelect(employee: Employee) {
    this.selectedEmployee.set(employee);
    this.reviewService.isEligibleForReview(employee.id).subscribe({
      next: (isEligible) => {
        if (isEligible) {
          this.initializeReviewForm();
          this.showReviewForm.set(true);
        } else {
          this.messageService.add({
            severity: 'warn',
            summary: 'Non éligible',
            detail: 'Cet employé a déjà été évalué dans les 6 derniers mois'
          });
        }
      }
    });
  }

  viewHistory(employee: Employee) {
    this.selectedEmployee.set(employee);
    this.loading.set(true);
    
    this.reviewService.getEmployeeReviews(employee.id).subscribe({
      next: (reviews) => {
        this.employeeReviews.set(reviews);
        this.showHistory.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Erreur',
          detail: 'Impossible de charger l\'historique des évaluations'
        });
        this.loading.set(false);
      }
    });
  }

  private initializeReviewForm() {
    this.metricsArray.clear();
    this.initializeMetrics();
    this.handleLoadingState();

    // Subscribe to form changes to update the score
    this.metricsArray.valueChanges.subscribe(() => {
      this.updateOverallScore();
    });
  }

  private updateOverallScore() {
    if (this.metricsArray.length === 0) {
      this.currentScore.set(0);
      return;
    }

    const totalScore = this.metricsArray.controls.reduce((total, control) => {
      const weight = control.get('weight')?.value || 0;
      const score = control.get('score')?.value || 0;
      return total + (weight * score);
    }, 0);

    this.currentScore.set(totalScore);
  }

  private initializeMetrics() {
    this.metrics().forEach(metric => {
      const formGroup = this.fb.group({
        category: [{ value: metric.category, disabled: false }],
        weight: [{ value: metric.weight, disabled: false }],
        score: [{ value: metric.score, disabled: false }, [Validators.required, Validators.min(0), Validators.max(5)]],
        comments: [{ value: metric.comments, disabled: false }, [Validators.required, Validators.minLength(10)]]
      });
      this.metricsArray.push(formGroup);
    });

    // Initial score calculation
    this.updateOverallScore();
  }

  private handleLoadingState() {
    this.loading.set(false);
  }

  getScoreColor(score: number): string {
    if (score >= 4) return 'text-green-500';
    if (score >= 3) return 'text-blue-500';
    if (score >= 2) return 'text-yellow-500';
    return 'text-red-500';
  }

  getProgressBarColor(score: number): string {
    if (score >= 4) return '#22C55E';
    if (score >= 3) return '#3B82F6';
    if (score >= 2) return '#EAB308';
    return '#EF4444';
  }

  isFieldInvalid(metricIndex: number, fieldName: string): boolean {
    const control = this.metricsArray.at(metricIndex).get(fieldName);
    return !!control && control.invalid && (control.dirty || control.touched || this.submitted());
  }

  getFieldErrorMessage(metricIndex: number, fieldName: string): string {
    const control = this.metricsArray.at(metricIndex).get(fieldName);
    if (!control) return '';
    
    if (control.hasError('required')) return 'Ce champ est requis';
    if (control.hasError('minlength')) return 'Le commentaire doit contenir au moins 10 caractères';
    return '';
  }

  setFormDisabled(disabled: boolean) {
    this.metricsArray.controls.forEach(control => {
      if (disabled) {
        control.disable();
      } else {
        control.enable();
      }
    });
  }

  trackByFn(index: number, item: any): number {
    return index;
  }

  async onSubmit() {
    if (!this.selectedEmployee()) {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez sélectionner un employé'
      });
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.submitted.set(true);
    
    if (this.reviewForm.valid) {
      this.loading.set(true);
      this.setFormDisabled(true);

      const review: PerformanceReview = {
        employeeId: this.selectedEmployee()!.id,
        managerId: currentUser.id,
        reviewDate: new Date(),
        metrics: this.metricsArray.value,
        overallScore: this.overallScore(),
        nextReviewDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
        status: 'completed'
      };

      this.reviewService.saveReview(review).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Succès',
            detail: 'Évaluation enregistrée avec succès'
          });
          this.showReviewForm.set(false);
          this.loadEligibleEmployees();
          this.selectedEmployee.set(null);
          this.submitted.set(false);
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Une erreur est survenue lors de l\'enregistrement'
          });
        },
        complete: () => {
          this.loading.set(false);
          this.setFormDisabled(false);
        }
      });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Veuillez corriger les erreurs dans le formulaire'
      });
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}