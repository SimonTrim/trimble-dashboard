/**
 * Types Mock pour l'API Trimble Connect
 * À REMPLACER par le vrai package @trimble/connect-workspace-api quand disponible
 * 
 * Ce fichier permet au projet de compiler sans avoir accès au package privé Trimble
 */

// Mock de l'objet TrimbleConnectWorkspace
export const TrimbleConnectWorkspace = {
  /**
   * Se connecter à l'API Trimble Connect
   */
  connect: async (): Promise<any> => {
    console.warn('⚠️ Using MOCK Trimble API - Replace with real API in production');
    
    return {
      project: {
        get: async () => ({
          id: 'mock-project-id',
          name: 'Projet de Démonstration',
          description: 'Ceci est un projet de démonstration',
        }),
      },
      
      notes: {
        getAll: async () => [
          {
            id: '1',
            title: 'Note 1',
            content: 'Contenu de la note 1',
            author: 'John Doe',
            createdAt: new Date('2026-01-25'),
            updatedAt: new Date('2026-01-28'),
            archived: false,
            projectId: 'mock-project-id',
          },
          {
            id: '2',
            title: 'Note 2',
            content: 'Contenu de la note 2',
            author: 'Jane Smith',
            createdAt: new Date('2026-01-26'),
            updatedAt: new Date('2026-01-27'),
            archived: false,
            projectId: 'mock-project-id',
          },
          {
            id: '3',
            title: 'Note archivée',
            content: 'Cette note est archivée',
            author: 'Bob Wilson',
            createdAt: new Date('2026-01-20'),
            updatedAt: new Date('2026-01-21'),
            archived: true,
            projectId: 'mock-project-id',
          },
        ],
        get: async (id: string) => ({
          id,
          title: `Note ${id}`,
          content: 'Contenu',
          author: 'John Doe',
          createdAt: new Date(),
          updatedAt: new Date(),
          archived: false,
          projectId: 'mock-project-id',
        }),
      },
      
      bcf: {
        getTopics: async () => [
          {
            id: '1',
            title: 'Problème de structure',
            description: 'La poutre est mal alignée',
            status: 'Open',
            priority: 'High',
            assignedTo: 'john.doe@example.com',
            createdBy: 'jane.smith@example.com',
            createdAt: new Date('2026-01-26'),
            modifiedAt: new Date('2026-01-28'),
            dueDate: new Date('2026-02-05'),
          },
          {
            id: '2',
            title: 'Révision des plans',
            description: 'Mise à jour nécessaire',
            status: 'In Progress',
            priority: 'Medium',
            assignedTo: 'bob.wilson@example.com',
            createdBy: 'john.doe@example.com',
            createdAt: new Date('2026-01-24'),
            modifiedAt: new Date('2026-01-27'),
          },
          {
            id: '3',
            title: 'Validation finale',
            description: 'À valider avant livraison',
            status: 'Resolved',
            priority: 'High',
            createdBy: 'jane.smith@example.com',
            createdAt: new Date('2026-01-20'),
            modifiedAt: new Date('2026-01-25'),
          },
          {
            id: '4',
            title: 'Correction mineure',
            description: 'Problème résolu',
            status: 'Closed',
            priority: 'Low',
            createdBy: 'bob.wilson@example.com',
            createdAt: new Date('2026-01-18'),
            modifiedAt: new Date('2026-01-22'),
          },
        ],
      },
      
      files: {
        getAll: async () => [
          {
            id: '1',
            name: 'plan-architecte.pdf',
            extension: 'pdf',
            size: 2458960,
            uploadedBy: 'john.doe@example.com',
            uploadedAt: new Date('2026-01-29T08:30:00'),
            lastModified: new Date('2026-01-29T08:30:00'),
            path: '/documents/plan-architecte.pdf',
          },
          {
            id: '2',
            name: 'maquette-3d.ifc',
            extension: 'ifc',
            size: 15678900,
            uploadedBy: 'jane.smith@example.com',
            uploadedAt: new Date('2026-01-28T14:20:00'),
            lastModified: new Date('2026-01-28T14:20:00'),
            path: '/models/maquette-3d.ifc',
          },
          {
            id: '3',
            name: 'specifications.docx',
            extension: 'docx',
            size: 567890,
            uploadedBy: 'bob.wilson@example.com',
            uploadedAt: new Date('2026-01-28T10:15:00'),
            lastModified: new Date('2026-01-28T10:15:00'),
            path: '/documents/specifications.docx',
          },
          {
            id: '4',
            name: 'photo-chantier.jpg',
            extension: 'jpg',
            size: 3456789,
            uploadedBy: 'john.doe@example.com',
            uploadedAt: new Date('2026-01-27T16:45:00'),
            lastModified: new Date('2026-01-27T16:45:00'),
            path: '/photos/photo-chantier.jpg',
          },
        ],
        getRecent: async (options: any) => {
          const api = await TrimbleConnectWorkspace.connect();
          const allFiles = await api.files.getAll();
          const cutoffDate = new Date(options.since);
          return allFiles.filter((file: any) => new Date(file.uploadedAt) >= cutoffDate);
        },
      },
      
      views: {
        getAll: async () => [
          {
            id: '1',
            name: 'Vue Principale',
            description: 'Vue d\'ensemble du projet',
            createdBy: 'john.doe@example.com',
            createdAt: new Date('2026-01-25'),
            thumbnail: 'thumbnail1.jpg',
            isDefault: true,
          },
          {
            id: '2',
            name: 'Vue Niveau 1',
            description: 'Premier étage',
            createdBy: 'jane.smith@example.com',
            createdAt: new Date('2026-01-26'),
            thumbnail: 'thumbnail2.jpg',
            isDefault: false,
          },
          {
            id: '3',
            name: 'Vue Façade Sud',
            description: 'Façade sud du bâtiment',
            createdBy: 'bob.wilson@example.com',
            createdAt: new Date('2026-01-27'),
            thumbnail: 'thumbnail3.jpg',
            isDefault: false,
          },
        ],
        get: async (id: string) => ({
          id,
          name: `Vue ${id}`,
          description: 'Description',
          createdBy: 'john.doe@example.com',
          createdAt: new Date(),
          isDefault: false,
        }),
      },
    };
  },
};
