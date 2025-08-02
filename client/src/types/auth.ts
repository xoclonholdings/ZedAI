// User interface for authentication
export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
}

// Auth response interface
export interface AuthResponse {
  user: User;
  verified: boolean;
}

// Auth hook return type
export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
}
