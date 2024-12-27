import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

export interface GeolocationPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface PointageRecord {
  id: number;
  employeeId: number;
  timestamp: Date;
  type: 'ENTREE' | 'SORTIE' | 'PAUSE_DEBUT' | 'PAUSE_FIN';
  location?: GeolocationPosition;
  device: string;
  status: string;
  mood?: 'HAPPY' | 'NEUTRAL' | 'TIRED';
  note?: string;
  weather?: {
    temperature: number;
    condition: string;
  };
}

export interface WorkingHoursSummary {
  totalHours: number;
  expectedHours: number;
  overtime: number;
  lateArrivals: number;
  earlyDepartures: number;
  averageDailyHours: number;
  mostProductiveDay: string;
  moodTrend: string;
  streakDays: number;
}

export interface WorkplaceZone {
  name: string;
  center: GeolocationPosition;
  radius: number; // in meters
}

@Injectable({
  providedIn: 'root'
})
export class PointageService {
  private readonly WORK_ZONES: WorkplaceZone[] = [];

  private mockData: {
    pointages: PointageRecord[];
    streakDays: number;
  } = {
    pointages: [
      {
        id: 1,
        employeeId: 1,
        timestamp: new Date(),
        type: 'ENTREE' as const,
        device: 'WEB',
        status: 'VALIDE',
        location: undefined,
        mood: undefined,
        note: undefined,
        weather: undefined
      }
    ],
    streakDays: 5
  };

  constructor(private http: HttpClient) {}

  // Enregistrer un nouveau pointage
  async enregistrerPointage(pointage: Partial<PointageRecord>): Promise<PointageRecord> {
    const weather = await this.getWeatherData(pointage.location!);
    
    const newPointage: PointageRecord = {
      id: this.mockData.pointages.length + 1,
      employeeId: 1,
      timestamp: new Date(),
      type: pointage.type || 'ENTREE',
      device: pointage.device || 'WEB',
      status: 'VALIDE',
      location: pointage.location,
      mood: pointage.mood,
      note: pointage.note,
      weather
    };

    if (pointage.type === 'ENTREE') {
      this.mockData.streakDays++;
    }

    this.mockData.pointages = [...this.mockData.pointages, newPointage];
    return newPointage;
  }

  // Obtenir l'historique des pointages
  getHistoriquePointages(dateDebut: Date, dateFin: Date): Observable<PointageRecord[]> {
    return of(this.mockData.pointages);
  }

  // Obtenir le résumé des heures de travail
  getWorkingHoursSummary(employeeId: number, startDate: Date, endDate: Date): Observable<WorkingHoursSummary> {
    return of({
      totalHours: 40,
      expectedHours: 40,
      overtime: 2,
      lateArrivals: 1,
      earlyDepartures: 0,
      averageDailyHours: 8.4,
      mostProductiveDay: 'Mardi',
      moodTrend: 'Positif',
      streakDays: this.mockData.streakDays
    });
  }

  // Vérifier si l'employé est dans la zone de pointage autorisée
  verifierZonePointage(position: GeolocationPosition): Observable<boolean> {
    // Si c'est le premier pointage, on ajoute la position comme zone autorisée
    if (this.WORK_ZONES.length === 0) {
      this.WORK_ZONES.push({
        name: 'Zone par défaut',
        center: position,
        radius: 100 // rayon de 100 mètres
      });
    }

    return of(this.WORK_ZONES.some(zone => {
      const distance = this.calculerDistance(
        position.latitude,
        position.longitude,
        zone.center.latitude,
        zone.center.longitude
      );
      return distance <= zone.radius;
    }));
  }

  private calculerDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance en mètres
  }

  private async getWeatherData(position: GeolocationPosition) {
    // Mock weather data
    return {
      temperature: 22,
      condition: 'Ensoleillé'
    };
  }

  getPointagesJour(employeeId: number, date: Date): Observable<PointageRecord[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const pointagesDuJour = this.mockData.pointages.filter(p => 
      p.timestamp >= startOfDay && p.timestamp <= endOfDay && p.employeeId === employeeId
    );

    return of(pointagesDuJour);
  }

  getPointagesPeriode(employeeId: number, dateDebut: Date, dateFin: Date): Observable<PointageRecord[]> {
    const startDate = new Date(dateDebut);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateFin);
    endDate.setHours(23, 59, 59, 999);

    const pointagesPeriode = this.mockData.pointages.filter(p => 
      p.timestamp >= startDate && p.timestamp <= endDate && p.employeeId === employeeId
    );

    return of(pointagesPeriode);
  }

  getStreakDays(): number {
    return this.mockData.streakDays;
  }
}
