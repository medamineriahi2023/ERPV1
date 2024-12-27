import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { Employee } from '../../../../shared/services/employee.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ApiService } from '../../../../core/services/api.service';
import { Router } from '@angular/router';
import { User } from '../../../../core/interfaces/user.interface';

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
  templateUrl: './employee-form.component.html'
})
export class EmployeeFormComponent implements OnInit {
  @Input() employee?: Employee;
  @Output() save = new EventEmitter<Partial<Employee>>();
  @Output() cancel = new EventEmitter<void>();
  @ViewChild('fileUpload') fileUpload!: FileUpload;

  employeeForm!: FormGroup;
  profileImageUrl: string = 'assets/images/default-avatar.png';
  submitting = false;
  currentStep = 0;
  items: MenuItem[] = [
    {
      label: 'Informations Personnelles',
      icon: 'pi pi-user'
    },
    {
      label: 'Informations Professionnelles',
      icon: 'pi pi-briefcase'
    },
    {
      label: 'Informations Salariales',
      icon: 'pi pi-money-bill'
    }
  ];
  yearRange: string = '';
  maxBirthDate: Date = new Date();
  minJoinDate: Date = new Date();
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
    { label: 'Stage', value: 'STAGE' },
    { label: 'Intérim', value: 'INTERIM' }
  ];

  statuses = [
    { label: 'Actif', value: 'ACTIVE' },
    { label: 'Inactif', value: 'INACTIVE' },
    { label: 'En congé', value: 'ON_LEAVE' }
  ];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router
  ) {
    this.initForm();
    this.initializeDateRanges();
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  private initializeDateRanges() {
    const currentYear = new Date().getFullYear();
    this.yearRange = `${currentYear - 70}:${currentYear - 18}`;
    this.maxBirthDate = new Date();
    this.maxBirthDate.setFullYear(currentYear - 18);
    this.minJoinDate = new Date();
    this.minJoinDate.setFullYear(currentYear - 5);
  }

  uploadFile(event: any) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  getContractTypeIcon(type: string): string {
    switch (type) {
      case 'CDI':
        return 'pi-check-circle';
      case 'CDD':
        return 'pi-clock';
      case 'STAGE':
        return 'pi-book';
      case 'INTERIM':
        return 'pi-sync';
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
      case 'ACTIVE':
        return 'status-active';
      case 'INACTIVE':
        return 'status-inactive';
      case 'ON_LEAVE':
        return 'status-leave';
      default:
        return '';
    }
  }

  getStatusLabel(status: string): string {
    const statusObj = this.statuses.find(s => s.value === status);
    return statusObj ? statusObj.label : status;
  }

  isStepValid(step: number): boolean {
    const controls = this.employeeForm.controls;
    switch (step) {
      case 0:
        return !!(controls['firstName']?.valid &&
               controls['lastName']?.valid &&
               controls['email']?.valid &&
               controls['phone']?.valid &&
               controls['birthDate']?.valid);
      case 1:
        return !!(controls['position']?.valid &&
               controls['department']?.valid &&
               controls['joinDate']?.valid &&
               controls['contractType']?.valid &&
               controls['status']?.valid);
      case 2:
        return true; // Always enable the button in the last step
      default:
        return false;
    }
  }

  nextStep() {
    if (this.currentStep < 2 && this.isStepValid(this.currentStep)) {
      this.currentStep++;
    }
  }

  previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  ngOnInit() {
    if (this.employee) {
      this.employeeForm.patchValue(this.employee);
      if (this.employee.avatar) {
        this.profileImageUrl = this.employee.avatar;
      }
    }
  }

  private initForm() {
    this.employeeForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^\+216 \d{2}-\d{3}-\d{3}$/)]],
      birthDate: [null, Validators.required],
      address: [''],
      username: ['', [Validators.required, Validators.minLength(4)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      position: ['', Validators.required],
      department: ['', Validators.required],
      joinDate: [new Date(), Validators.required],
      status: ['ACTIVE', Validators.required],
      skills: [''],
      contractType: ['', Validators.required],
      salary: this.fb.group({
        base: [0],
        bonus: [0]
      }),
      performanceRating: [0],
      role: ['employee']
    });
  }

  async onSubmit() {
    if (this.employeeForm.valid || this.currentStep === 2) {
      this.submitting = true;
      try {
        const formValue = this.employeeForm.value;
        
        // Format the dates
        const hireDate = formValue.joinDate ? new Date(formValue.joinDate) : new Date();
        
        // Convert skills from string to array if needed
        const skills = formValue.skills ? formValue.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        
        // Prepare the employee data
        const newEmployee: Omit<User, 'id'> = {
          username: formValue.username,
          password: formValue.password,
          email: formValue.email,
          firstName: formValue.firstName,
          lastName: formValue.lastName,
          name: `${formValue.firstName} ${formValue.lastName}`,
          role: 'employee',
          photoUrl: this.profileImageUrl,
          department: formValue.department,
          position: formValue.position,
          managerId: this.currentUser?.id || null,
          managedEmployees: [],
          hireDate: hireDate,
          leaveBalance: {
            annual: 30,
            sick: 15
          },
          workSchedule: {
            startTime: "09:00",
            endTime: "17:00",
            lunchBreakDuration: 60
          },
          rating: formValue.performanceRating || 0,
          status: 'active',
          contractType: formValue.contractType
        };

        // Create the employee using the API service
        const response = await this.apiService.createUser(newEmployee).toPromise();
        
        if (response) {
          // Update the manager's managedEmployees array if there is a manager
          if (this.currentUser?.id) {
            const currentManagedEmployees = this.currentUser.managedEmployees || [];
            const updatedManager = {
              ...this.currentUser,
              managedEmployees: [...currentManagedEmployees, response.id]
            };
            await this.apiService.updateUser(this.currentUser.id, updatedManager).toPromise();
          }

          // Show success message
          console.log('Employee created successfully:', response);
          
          // Navigate back to employees list
          this.router.navigate(['/employees']);
        }
      } catch (error) {
        console.error('Error creating employee:', error);
      } finally {
        this.submitting = false;
      }
    } else {
      // Mark all fields as touched to show validation errors
      Object.keys(this.employeeForm.controls).forEach(key => {
        const control = this.employeeForm.get(key);
        control?.markAsTouched();
      });
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  onFileUpload(event: any) {
    const file = event.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.profileImageUrl = e.target.result;
      };
      reader.readAsDataURL(file);
      this.fileUpload.clear();
    }
  }

  isFieldInvalid(field: string): boolean {
    const control = this.employeeForm.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  getFieldError(field: string): string {
    const control = this.employeeForm.get(field);
    if (control?.errors) {
      if (control.errors['required']) {
        return 'Ce champ est requis';
      }
      if (control.errors['email']) {
        return 'Email invalide';
      }
      if (control.errors['minlength']) {
        return `Minimum ${control.errors['minlength'].requiredLength} caractères`;
      }
      if (control.errors['pattern']) {
        return 'Format invalide';
      }
    }
    return '';
  }
}
