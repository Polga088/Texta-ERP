export interface User {
  id: string;
  email: string;
  full_name: string;
  global_role: string;
  organization_id: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  owner_id?: string;
  account_id?: string;
  company_name?: string;
  company_logo_url?: string;
  project_code?: string;
  scope_statement?: string;
  iso_context?: string;
  iso_risk_register?: string;
  iso_objectives?: string;
  iso_kpis?: string;
  iso_acceptance_criteria?: string;
  iso_document_control?: boolean;
  iso_change_control?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  project_id?: string;
  assignee_id?: string;
  position: number;
  due_date?: string;
}

export interface Account {
  id: string;
  name: string;
  industry?: string;
}

export interface Employee {
  id: string;
  employee_number: string;
  job_title: string;
  department_id?: string;
  manager_id?: string;
  user_id?: string;
  status: string;
}

export interface Department {
  id: string;
  name: string;
  parent_id?: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  meeting_url?: string;
  start_at: string;
  end_at: string;
  project_id?: string;
  attendees: { id: string; user_id: string; response_status: string }[];
}

export interface DashboardStats {
  projects_total: number;
  projects_active: number;
  tasks_total: number;
  tasks_done: number;
  employees_total: number;
  leave_pending: number;
  events_this_week: number;
  accounts_total: number;
}

export interface Grant {
  id: string;
  project_id: string;
  grantee_type: string;
  grantee_id: string;
  permissions: string[];
}

export interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  created_at: string;
  details?: Record<string, unknown>;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  member_count: number;
}

export interface Lead {
  id: string;
  title: string;
  source?: string;
  status: "new" | "qualified" | "proposal" | "won" | "lost";
  estimated_value?: number;
  expected_close_date?: string;
  owner_id?: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  project_id?: string;
  sender_id?: string;
  created_at: string;
}

export interface UserNotification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  entity_type?: string;
  entity_id?: string;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  project_id: string;
  task_id?: string;
  started_at: string;
  ended_at?: string;
  duration_minutes: number;
  note?: string;
  source: string;
}
