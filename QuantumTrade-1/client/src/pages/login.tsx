import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function Login() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiRequest('POST', '/api/login', { username, password });
      const data = await response.json();

      if (data.success) {
        setAuthenticated(true);
        toast({
          title: "Login Successful",
          description: "Welcome to OANDA Trading Dashboard",
        });
        setLocation('/');
      }
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background cyberpunk-grid">
      <Card className="w-full max-w-md mx-4 card-cyberpunk">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-neon-cyan neon-glow">
            OANDA TRADING
          </CardTitle>
          <p className="text-muted-foreground mt-2">
            Access your trading dashboard
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-foreground">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-cyberpunk"
                placeholder="Enter username"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-cyberpunk"
                placeholder="Enter password"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full btn-neon-blue pulse-glow"
            >
              {isLoading ? 'Authenticating...' : 'LOGIN'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-muted/10 rounded-lg border border-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              Demo Credentials:<br />
              Username: <span className="text-neon-cyan">trader</span><br />
              Password: <span className="text-neon-cyan">trading123</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
