import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, History, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

interface AccountInfo {
  account_id: string;
  balance: number;
  total_winnings: number;
  total_buyins: number;
  total_payouts: number;
  transaction_count: number;
}

export function UserAccountDetails() {
  const [userId, setUserId] = useState('');
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchAccountInfo = async () => {
    if (!userId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_user_account_info', { target_user_id: userId });

      if (error) throw error;

      if (data && data.length > 0) {
        setAccountInfo(data[0]);
      } else {
        toast.error('No account found for this user');
        setAccountInfo(null);
      }
    } catch (error: any) {
      console.error('Error fetching account info:', error);
      toast.error(error.message || 'Failed to fetch account information');
      setAccountInfo(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Account Lookup</CardTitle>
          <CardDescription>
            View account balance and transaction summary for any user
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="Enter user UUID"
              />
            </div>
            <Button
              onClick={fetchAccountInfo}
              disabled={loading}
              className="mt-auto bg-gradient-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Lookup
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {accountInfo && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                ${parseFloat(accountInfo.balance.toString()).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Total Winnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                ${parseFloat(accountInfo.total_winnings.toString()).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                Total Buy-ins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">
                ${parseFloat(accountInfo.total_buyins.toString()).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-blue-500" />
                Total Payouts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                ${parseFloat(accountInfo.total_payouts.toString()).toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {accountInfo.transaction_count}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Net Profit/Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${
                (parseFloat(accountInfo.total_winnings.toString()) - parseFloat(accountInfo.total_buyins.toString())) >= 0 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                ${(parseFloat(accountInfo.total_winnings.toString()) - parseFloat(accountInfo.total_buyins.toString())).toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
