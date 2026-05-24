export interface User {
  id: string;
  email: string;
  full_name: string;
  global_role: string;
  organization_id: string;
}

export interface Project {
  id: string;
  created_at?: string;
  updated_at?: string;
  name: string;
  description?: string;
  status:
    | "draft"
    | "planning"
    | "in_progress"
    | "on_hold"
    | "in_review"
    | "done"
    | "cancelled"
    | "lead"
    | "active"
    | "completed";
  project_type?: "internal" | "client" | "partnership" | "rnd" | "marketing" | "event";
  category?: string;
  owner_id?: string;
  client_lead_id?: string;
  project_manager_id?: string;
  account_id?: string;
  start_date?: string;
  end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  duration_days?: number;
  delay_days?: number;
  budget?: number;
  budget_consumed?: number;
  budget_remaining?: number;
  budget_alert_threshold?: number;
  currency?: string;
  hourly_rate?: number;
  team_members?: Array<{
    user_id: string;
    role: string;
    allocation_percentage: number;
    joined_at?: string;
  }>;
  priority?: "critical" | "high" | "medium" | "low";
  tags?: string[];
  visibility?: "public" | "private" | "restricted";
  deliverables?: Array<{
    name: string;
    description?: string;
    due_date?: string;
    status?: string;
    attachments?: string[];
  }>;
  project_documents?: string[];
  notes?: string;
  completion_percentage?: number;
  health_status?: "good" | "watch" | "danger" | "not_evaluated";
  pause_reason?: string;
  cancel_reason?: string;
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

export interface ProjectKpis {
  active_count: number;
  completed_count: number;
  completed_percent: number;
  delayed_count: number;
  paused_count: number;
  completion_avg: number;
  budget_consumed_percent: number;
  hours_month: number;
  risk_count: number;
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
  created_at?: string;
  updated_at?: string;
  title: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  company_name?: string;
  company_website?: string;
  contact_job_title?: string;
  source?: string;
  status: "new" | "qualified" | "proposal" | "won" | "lost";
  deal_value?: number;
  currency?: "MAD" | "EUR" | "USD";
  product_service?: string;
  estimated_value?: number;
  expected_close_date?: string;
  conversion_probability?: number;
  priority?: "high" | "medium" | "low";
  marketing_campaign?: string;
  owner_id?: string;
  assigned_to?: string;
  last_activity?: string;
  next_action_type?: "call" | "email" | "meeting" | "quote" | "follow_up" | "none";
  next_action_date?: string;
  next_action_note?: string;
  description?: string;
  tags?: string[];
  attachments?: string[];
  lost_reason?: "price_too_high" | "wrong_timing" | "competitor" | "no_budget" | "internal_decision" | "other";
  lost_competitor?: string;
  notes?: string;
}

export interface LeadKpis {
  new_count: number;
  pipeline_count: number;
  won_count: number;
  lost_count: number;
  conversion_rate: number;
  pipeline_value: number;
  won_value: number;
  lost_value: number;
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
