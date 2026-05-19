/**
 * Shape of ZED's core behavior config — both the live document
 * loaded from core.memory.json and the in-memory fallback used
 * when that file is missing or invalid.
 */
export type CoreMemoryConfig = {
  version: string;
  _notes?: string;
  identity: {
    name: string;
    role: string;
    mission: string;
  };
  tone: {
    mode: string;
    baseline: string;
    rules: string[];
    _planned?: string;
  };
  operation: {
    execution_mode: string;
    default_behavior: string;
    _notes?: string;
  };
  modes: {
    available: string[];
    behavior: string;
    _notes?: string;
  };
  memory_policy: {
    usage: string;
    sensitive_handling: string;
    classification_levels: string[];
    _notes?: string;
  };
  access_control: {
    roles: Record<string, string[]>;
    override: {
      enabled: boolean;
      _notes?: string;
    };
  };
  risk_model: {
    tiers: string[];
    definitions: Record<string, string>;
    enforcement: {
      critical_requires: string[];
    };
  };
  instruction_model: {
    required_fields: string[];
    confirmation_required_for: string[];
    ambiguity_handling: string;
    _notes?: string;
  };
  tool_policy: {
    actions: string[];
    enforcement_order: string[];
    _notes?: string;
  };
  secrets_policy: {
    default_behavior: string;
    allowed_behavior: string[];
    critical_access: {
      requires: string[];
    };
  };
  session_awareness: {
    mode: string;
    behaviors: string[];
    _planned?: string;
  };
  non_admin_behavior: {
    mode: string;
    capabilities: string[];
    restrictions: string[];
  };
};
