export type AppRole = "super_admin" | "employee" | "dept_head" | "office_services";

export type CartStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "stored"
  | "pending_retrieval_approval"
  | "retrieval_approved"
  | "retrieved"
  | "pending_return_approval"
  | "return_approved"
  | "disposed"
  | "rejected";

export type RetrievalType = "normal" | "urgent";
export type POType = "storage" | "transport" | "urgent_retrieval";

export interface Department {
  id: string;
  name: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  department_id: string | null;
  is_active: boolean;
}

export interface Cart {
  id: string;
  cart_number: string;
  department_id: string;
  status: CartStatus;
  retention_days: number;
  disposal_date: string | null;
  retrieval_type: RetrievalType | null;
  rejection_reason: string | null;
  created_by: string;
  approved_by: string | null;
  stored_at: string | null;
  retrieved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  cart_id: string;
  document_name: string;
  document_number: string;
  retention_period: number;
  file_number: string | null;
  file_name: string | null;
  department_id: string;
  created_by: string;
  created_at: string;
  registration_date: string | null;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  employee: "Employee",
  dept_head: "Department Head",
  office_services: "Office Services",
};

export const STATUS_LABELS: Record<CartStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  stored: "Stored",
  pending_retrieval_approval: "Pending Retrieval Approval",
  retrieval_approved: "Retrieval Approved",
  retrieved: "Retrieved",
  pending_return_approval: "Pending Return Approval",
  return_approved: "Return Approved",
  disposed: "Disposed",
  rejected: "Rejected",
};
