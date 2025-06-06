import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputMaskModule } from 'primeng/inputmask';
import { StepsModule } from 'primeng/steps';
import { RatingModule } from 'primeng/rating';
import { ChipModule } from 'primeng/chip';
import { PasswordModule } from 'primeng/password';
import { FileUpload, FileUploadModule } from 'primeng/fileupload';
import { MenuItem, MessageService } from 'primeng/api';
import { Employee } from '../../../../shared/services/employee.service';
import { ApiService } from '../../../../core/services/api.service';
import { Router } from '@angular/router';
import { User } from '../../../../core/interfaces/user.interface';
import { AuthService } from '../../../../core/services/auth.service';
import { switchMap, tap } from 'rxjs/operators';
import { CloudinaryService } from '../../../../core/services/cloudinary.service';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    CalendarModule,
    InputNumberModule,
    InputMaskModule,
    StepsModule,
    RatingModule,
    ChipModule,
    PasswordModule,
    FileUploadModule
  ],
  templateUrl: './employee-form.component.html',
  providers: [MessageService]
})
export class EmployeeFormComponent implements OnInit {
  @Input() employee?: Employee;
  @Output() save = new EventEmitter<Partial<Employee>>();
  @Output() cancel = new EventEmitter<void>();
  @ViewChild('fileUpload') fileUpload!: FileUpload;

  employeeForm!: FormGroup;
  imageUrl: string = '';
  uploadInProgress = false;
  profileImageUrl: string = 'assets/images/default-avatar.png';
  items!: MenuItem[];
  activeIndex: number = 0;
  currentStep: number = 0;
  submitting: boolean = false;
  minJoinDate: Date = new Date();
  yearRange: string;
  maxBirthDate: Date;
  hourFormat: string = "24";
  currentUser: User | null = null;

  departments = [
    { label: 'Engineering', value: 'Engineering' },
    { label: 'Product', value: 'Product' },
    { label: 'Marketing', value: 'Marketing' },
    { label: 'Sales', value: 'Sales' },
    { label: 'HR', value: 'HR' },
    { label: 'Finance', value: 'Finance' }
  ];

  contractTypes = [
    { label: 'CDI', value: 'CDI' },
    { label: 'CDD', value: 'CDD' },
    { label: 'Stage', value: 'Intern' }
  ];

  statuses = [
    { label: 'Actif', value: 'active' },
    { label: 'Inactif', value: 'inactive' },
    { label: 'En congé', value: 'on_leave' }
  ];

  roles = [
    { label: 'Employé', value: 'employee', icon: 'pi-user' },
    { label: 'Manager', value: 'manager', icon: 'pi-briefcase' }
  ];

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private router: Router,
    private authService: AuthService,
    private messageService: MessageService,
    private cloudinaryService: CloudinaryService
  ) {
    this.initForm();
    this.initializeSteps();
    this.initializeDates();
    this.currentUser = this.authService.getCurrentUser();
  }

  private initializeDates() {
    const currentYear = new Date().getFullYear();
    this.yearRange = `${currentYear - 70}:${currentYear - 18}`;
    this.maxBirthDate = new Date();
    this.maxBirthDate.setFullYear(currentYear - 18);
    this.minJoinDate = new Date();
    this.minJoinDate.setFullYear(currentYear - 5);
  }

  ngOnInit() {
    if (this.employee) {
      this.employeeForm.patchValue(this.employee);
      this.profileImageUrl = this.employee.photoUrl || this.profileImageUrl;
    }
  }

  private initForm(): void {
    this.employeeForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      username: ['', Validators.required],
      password: ['', [
        Validators.required,
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      ]],
      phone: [''],
      birthDate: [null],
      address: [''],
      profileImage: [''],
      gender: [''],
      city: [''],
      country: [''],
      position: ['', [Validators.required]],
      department: ['Engineering'],
      joinDate: [new Date()],
      salary: this.fb.group({
        base: [0],
        bonus: [0],
        lastReview: [new Date()]
      }),
      status: ['active'],
      contractType: ['CDI'],
      skills: [[]],
      workSchedule: this.fb.group({
        startTime: ['09:00'],
        endTime: ['17:00'],
        lunchBreakDuration: [60]
      }),
      performanceRating: [0],
      role: ['employee'],
    });
  }

  private initializeSteps() {
    this.items = [
      { label: 'Informations Personnelles' },
      { label: 'Informations Professionnelles' },
      { label: 'Salaire et Horaires' }
    ];
  }

  getContractTypeIcon(type: string): string {
    switch (type) {
      case 'CDI':
        return 'pi-check-circle';
      case 'CDD':
        return 'pi-clock';
      case 'Intern':
        return 'pi-book';
      default:
        return 'pi-question-circle';
    }
  }

  getContractTypeLabel(type: string): string {
    const contract = this.contractTypes.find(c => c.value === type);
    return contract ? contract.label : type;
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'inactive':
        return 'status-inactive';
      case 'on_leave':
        return 'status-leave';
      default:
        return '';
    }
  }

  getStatusLabel(status: string): string {
    const statusObj = this.statuses.find(s => s.value === status);
    return statusObj ? statusObj.label : status;
  }

  getRoleIcon(role: string): string {
    switch (role) {
      case 'employee':
        return 'pi-user';
      case 'manager':
        return 'pi-briefcase';
      default:
        return 'pi-user';
    }
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'employee':
        return 'Employé';
      case 'manager':
        return 'Manager';
      default:
        return role;
    }
  }

  isStepValid(step: number): boolean {
    return true;
  }

  async onSubmit() {
    try {
      this.submitting = true;
      const formData = this.employeeForm.value;
      
      const newUser: Omit<User, 'id'> = {
        username: formData.username,
        email: formData.email,
        firstName: formData.firstName,
        password: formData.password,
        lastName: formData.lastName,
        name: `${formData.firstName} ${formData.lastName}`,
        role: formData.role,
        department: formData.department,
        position: formData.position,
        managerId: this.currentUser?.id || null,
        managedEmployees: [],
        hireDate: formData.joinDate,
        leaveBalance: {
          annual: 30,
          sick: 15
        },
        workSchedule: {
          startTime: formData.workSchedule.startTime,
          endTime: formData.workSchedule.endTime,
          lunchBreakDuration: formData.workSchedule.lunchBreakDuration
        },
        rating: formData.performanceRating || 0,
        status: formData.status || 'active',
        contractType: formData.contractType || 'CDI',
        photoUrl: this.imageUrl
      };

      this.apiService.createUser(newUser).pipe(
        switchMap(createdUser => {
          if (this.currentUser?.id) {
            // D'abord obtenir l'utilisateur courant à jour
            return this.apiService.getUserById(this.currentUser.id).pipe(
              switchMap(currentUser => {
                // Ajouter le nouvel ID à la liste existante
                const updatedManagedEmployees = [...(currentUser.managedEmployees || []), createdUser.id];
                // Mettre à jour l'utilisateur avec la nouvelle liste
                return this.apiService.updateUser(this.currentUser.id, {
                  managedEmployees: updatedManagedEmployees
                });
              })
            );
          }
          return [];
        })
      ).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Succès',
            detail: 'Employé ajouté avec succès'
          });
          this.router.navigate(['/employees']);
        },
        error: (error) => {
          console.error('Erreur lors de la création de l\'employé:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Erreur',
            detail: 'Une erreur est survenue lors de la création de l\'employé'
          });
        },
        complete: () => {
          this.submitting = false;
        }
      });
    } catch (error) {
      console.error('Erreur lors de la création de l\'employé:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Une erreur est survenue lors de la création de l\'employé'
      });
      this.submitting = false;
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  async nextStep() {
    if (this.currentStep < 2) {
      this.currentStep++;
    }else {
     await this.onSubmit();
    }
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  onImageUpload(event: any) {
    const file = event.files[0];
    if (file) {
      this.uploadInProgress = true;
      this.cloudinaryService.uploadImage(file).subscribe({
        next: (url) => {
          this.imageUrl = url;
          this.employeeForm.patchValue({ profileImage: url });
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Image uploaded successfully'
          });
          this.uploadInProgress = false;
          if (this.fileUpload) {
            this.fileUpload.clear();
          }
        },
        error: (error) => {
          console.error('Upload failed:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to upload image. Please try again.'
          });
          this.uploadInProgress = false;
        }
      });
    }
  }
}
