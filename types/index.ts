export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: Date;
}

export interface Requirement {
  id: string;
  label: string;
  checked: boolean;
}

export interface PhaseStatus {
  name: string;
  startDate: string;
  endDate: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  progress: number;
}

export interface Estimate {
  constructionCost: number;
  materialCost: number;
  laborCost: number;
  otherExpenses: number;
  total: number;
}

export interface Subcontractor {
  id: string;
  name: string;
  role: string;
  phone: string;
  status: 'active' | 'pending';
}

export interface Project {
  id: string;
  ownerId: string;
  projectName: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  siteLocation: string;
  plotArea: string;
  projectType: 'New Construction' | 'Renovation';
  requirements: Requirement[];
  startDate: string;
  expectedCompletion: string;
  estimate: Estimate;
  materials: string[];
  subcontractors: Subcontractor[];
  phases: PhaseStatus[];
  overallProgress: number;
  status: 'Planning' | 'In Progress' | 'Completed';
  coverPhoto?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Payment {
  id: string;
  projectId: string;
  date: string;
  milestone: string;
  amount: number;
  status: 'Paid' | 'Pending';
}

export interface ProjectUpdate {
  id: string;
  projectId: string;
  message: string;
  phases: string[];
  photos: string[];
  sentAt: Date;
}

export const DEFAULT_PHASES: PhaseStatus[] = [
  { name: 'Foundation', startDate: '', endDate: '', status: 'upcoming', progress: 0 },
  { name: 'Plinth', startDate: '', endDate: '', status: 'upcoming', progress: 0 },
  { name: 'Structure', startDate: '', endDate: '', status: 'upcoming', progress: 0 },
  { name: 'Brick Work', startDate: '', endDate: '', status: 'upcoming', progress: 0 },
  { name: 'Plumbing & Electrical', startDate: '', endDate: '', status: 'upcoming', progress: 0 },
  { name: 'Plastering', startDate: '', endDate: '', status: 'upcoming', progress: 0 },
  { name: 'Flooring', startDate: '', endDate: '', status: 'upcoming', progress: 0 },
  { name: 'Painting', startDate: '', endDate: '', status: 'upcoming', progress: 0 },
  { name: 'Handover', startDate: '', endDate: '', status: 'upcoming', progress: 0 },
];

export const DEFAULT_REQUIREMENTS: Requirement[] = [
  { id: '1', label: '2 BHK House', checked: false },
  { id: '2', label: 'Modern Elevation', checked: false },
  { id: '3', label: 'Vastu Compliant', checked: false },
  { id: '4', label: 'Car Parking', checked: false },
  { id: '5', label: 'Modular Kitchen', checked: false },
];

export const MATERIALS_STRUCTURE = [
  { id: 'cement', label: 'Cement', icon: '🏗️' },
  { id: 'sand', label: 'Sand', icon: '🪨' },
  { id: 'bricks', label: 'Bricks', icon: '🧱' },
  { id: 'steel', label: 'Steel', icon: '⚙️' },
  { id: 'gravel', label: 'Gravel', icon: '🪨' },
  { id: 'rmc', label: 'RMC', icon: '🏗️' },
];

export const MATERIALS_FINISHING = [
  { id: 'blocks', label: 'Blocks', icon: '🧱' },
  { id: 'tiles', label: 'Tiles', icon: '🪟' },
  { id: 'wood', label: 'Wood', icon: '🪵' },
];

export const MATERIALS_OTHERS = [
  { id: 'pipes', label: 'Pipes', icon: '🔧' },
  { id: 'wire', label: 'Wire', icon: '🔌' },
  { id: 'paint', label: 'Paint', icon: '🎨' },
];
