import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';


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

}
