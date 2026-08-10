import type { User, UpsertUser } from "../../shared/UsersSchema.js";

const ADMIN_USER: User = {
  id: "user_001",
  username: "Admin",
  email: "admin@zar-ai.online",
  firstName: "ZAR",
  lastName: "Admin",
  profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=admin",
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date(),
} as unknown as User;

export class UserDatabaseStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (id === ADMIN_USER.id) return ADMIN_USER;
    return undefined;
  }

  async upsertUser(_userData: UpsertUser): Promise<User> {
    return ADMIN_USER;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (username === "Admin") return ADMIN_USER;
    return undefined;
  }

  async createUser(_userData: any): Promise<User> {
    return ADMIN_USER;
  }

  async getAllUsers(): Promise<User[]> {
    return [ADMIN_USER];
  }

  async updateUser(_id: string, _userData: Partial<any>): Promise<User> {
    return ADMIN_USER;
  }

  async deleteUser(_id: string): Promise<boolean> {
    return false;
  }
}
