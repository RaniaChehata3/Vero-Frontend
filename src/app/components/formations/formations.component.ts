import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormationService } from '../../services/formation.service';
import { SessionService } from '../../services/session.service';
import { Formation, Session } from '../../services/formation.models';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-formations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formations.component.html',
  styleUrl: './formations.component.css'
})
export class FormationsComponent implements OnInit {
  formations: Formation[] = [];
  sessions: { [formationId: number]: Session[] } = {};
  loading = true;
  error: string | null = null;
  selectedFormationId: number | null = null;

  constructor(
    private formationService: FormationService,
    private sessionService: SessionService,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadFormations();
  }

  loadFormations(): void {
    this.loading = true;
    this.formationService.getAvailable().subscribe({
      next: (data) => {
        this.formations = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des formations';
        this.loading = false;
        console.error(err);
      }
    });
  }

  loadSessions(formationId: number): void {
    if (this.sessions[formationId]) {
      return; // Already loaded
    }

    this.sessionService.getByFormation(formationId).subscribe({
      next: (data) => {
        this.sessions[formationId] = data;
      },
      error: (err) => {
        console.error('Error loading sessions:', err);
        this.notificationService.show('Erreur lors du chargement des sessions', 'error');
      }
    });
  }

  toggleSessions(formationId: number): void {
    if (this.selectedFormationId === formationId) {
      this.selectedFormationId = null;
    } else {
      this.selectedFormationId = formationId;
      this.loadSessions(formationId);
    }
  }

  register(formationId: number): void {
    if (!this.authService.isLoggedIn) {
      this.notificationService.show('Veuillez vous connecter pour vous inscrire', 'warning');
      return;
    }

    this.authService.getCurrentUser().subscribe({
      next: (user) => {
        this.formationService.register(formationId, user.id).subscribe({
          next: () => {
            this.notificationService.show('Inscription réussie !', 'success');
            this.loadFormations();
          },
          error: (err) => {
            console.error(err);
            this.notificationService.show('Erreur lors de l\'inscription', 'error');
          }
        });
      },
      error: (err) => {
        console.error(err);
        this.notificationService.show('Erreur lors de la récupération de l\'utilisateur', 'error');
      }
    });
  }

  getAvailableSpots(formation: Formation): number {
    const registered = formation.participantIds?.length || 0;
    return formation.maxCapacity - registered;
  }

  getStatusLabel(status: string): string {
    const labels: { [key: string]: string } = {
      'PLANNED': 'Planifiée',
      'IN_PROGRESS': 'En cours',
      'COMPLETED': 'Terminée',
      'SCHEDULED': 'Programmée',
      'CANCELLED': 'Annulée'
    };
    return labels[status] || status;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getSessionsForFormation(formationId: number): Session[] {
    return this.sessions[formationId] || [];
  }

  isSessionsExpanded(formationId: number): boolean {
    return this.selectedFormationId === formationId;
  }
}
