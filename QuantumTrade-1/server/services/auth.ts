export class AuthService {
  private readonly validCredentials = {
    username: 'trader',
    password: 'trading123'
  };

  validateCredentials(username: string, password: string): boolean {
    return username === this.validCredentials.username && 
           password === this.validCredentials.password;
  }

  generateSession(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}
