import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';

export interface CongeStats {
  joursDisponibles: number;
  joursAccumules: number;
}

export interface Demande {
  id: number;
  type: string;
  dateDebut: Date;
  dateFin: Date;
  jours: number;
  statut: string;
  commentaire?: string;
  pieceJointe?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CongesService {
  private mockData = {
    conges: [
      {
        id: 1,
        utilisateurId: 2,
        type: "Annuel",
        joursDisponibles: 18,
        joursAccumules: 1.5,
        historique: [
          {
            id: 1,
            dateDemande: "2024-01-10",
            dateDebut: "2024-02-01",
            dateFin: "2024-02-03",
            jours: 2,
            statut: "Approuvé",
            commentaire: "Vacances d'hiver",
            approuvePar: 1,
            dateApprobation: "2024-01-11"
          }
        ]
      }
    ]
  };

  constructor(private http: HttpClient) {}

  getCongeStats(): Observable<CongeStats> {
    // Mock data
    return of({
      joursDisponibles: this.mockData.conges[0].joursDisponibles,
      joursAccumules: this.mockData.conges[0].joursAccumules
    });
  }

  getDemandesConges(): Observable<Demande[]> {
    // Mock data
    return of(this.mockData.conges[0].historique.map(h => ({
      id: h.id,
      type: this.mockData.conges[0].type,
      dateDebut: new Date(h.dateDebut),
      dateFin: new Date(h.dateFin),
      jours: h.jours,
      statut: h.statut,
      commentaire: h.commentaire
    })));
  }

  soumettreDemandeConge(demande: Partial<Demande>): Observable<any> {
    // Mock submission
    console.log('Soumission de la demande:', demande);
    return of({ success: true });
  }

  annulerDemandeConge(demandeId: number): Observable<boolean> {
    // Dans un vrai projet, ceci serait un appel HTTP DELETE ou PATCH
    return of(true);
  }

  approuverDemandeConge(demandeId: number): Observable<boolean> {
    // Dans un vrai projet, ceci serait un appel HTTP PATCH
    return of(true);
  }

  refuserDemandeConge(demandeId: number, motif: string): Observable<boolean> {
    // Dans un vrai projet, ceci serait un appel HTTP PATCH
    return of(true);
  }
}
