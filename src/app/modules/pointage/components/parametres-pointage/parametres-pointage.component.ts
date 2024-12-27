import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-parametres-pointage',
  template: `
    <div class="container mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-6">Paramètres de Pointage</h1>
      <p-card>
        <h2>Fonctionnalité en cours de développement</h2>
      </p-card>
    </div>
  `,
  standalone: true,
  imports: [CommonModule, CardModule]
})
export class ParametresPointageComponent {}
