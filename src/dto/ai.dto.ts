export interface AIAnalysisResponse {
  document_id?: string;
  file_name?: string;
  document_family: string;
  document_type?: string; // AI uses document_type, not subtype
  subtype?: string; // Fallback for backward compatibility
  confidence?: number;
  compliance_score?: number;
  risk_profile?: string;
  holder?: {
    type?: string;
    name?: string;
    role_type?: string;
    confidence?: number;
    [key: string]: unknown;
  };
  roles?: {
    roles?: Array<{
      role_type?: string;
      entity_type?: string;
      name?: string;
      contact_info?: {
        email?: string | null;
        phone?: string | null;
      };
      confidence?: number;
      [key: string]: unknown;
    }>;
    primary_holder?: {
      role_type?: string;
      entity_type?: string;
      name?: string;
      confidence?: number;
      [key: string]: unknown;
    };
    confidence?: number;
    [key: string]: unknown;
  };
  claims?: {
    claim_type?: string;
    is_contractor?: boolean | null;
    amount?: number | null;
    currency?: string | null;
    subject?: string | null;
    entity?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    [key: string]: unknown;
  };
  extracted_claims?: Record<string, unknown>; // Alias for claims (backward compatibility)
  intent?: {
    primary_intent?: string;
    secondary_intents?: string[];
    trust_role?: string;
    risk_profile?: string;
    confidence?: number;
    explanation?: string;
    [key: string]: unknown;
  };
  process_context?: {
    business_process?: string;
    compliance_domain?: string;
    lifecycle_stage?: string;
    recommended_actions?: string[];
    confidence?: number;
    explanation?: string;
    [key: string]: unknown;
  };
  metadata?: {
    text_length?: number;
    has_tables?: boolean;
    detected_language?: string;
    extracted_fields?: string[];
    [key: string]: unknown;
  };
  anomalies?: unknown[];
  explainability?: {
    reasoning?: string[];
    anomalies?: string[];
    warnings?: string[];
  };
  [key: string]: unknown;
}
