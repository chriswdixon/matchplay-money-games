import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useInvites } from '@/hooks/useInvites';
import { Copy, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';

export const InviteManagement = () => {
  const { invites, loading, generateInvite } = useInvites();
  const { toast } = useToast();
  const [expiryDays, setExpiryDays] = useState('30');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    const code = await generateInvite(parseInt(expiryDays) || 30);
    setGenerating(false);

    if (code) {
      // Auto-copy to clipboard
      navigator.clipboard.writeText(code);
      toast({
        title: 'Invite Generated',
        description: 'Code copied to clipboard',
      });
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Copied',
      description: 'Invite code copied to clipboard',
    });
  };

  const getStatusBadge = (invite: any) => {
    if (invite.used_by) {
      return <Badge variant="outline" className="bg-green-50"><CheckCircle2 className="h-3 w-3 mr-1" />Used</Badge>;
    }
    if (new Date(invite.expires_at) < new Date()) {
      return <Badge variant="outline" className="bg-red-50"><XCircle className="h-3 w-3 mr-1" />Expired</Badge>;
    }
    return <Badge variant="outline" className="bg-blue-50"><Clock className="h-3 w-3 mr-1" />Active</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Invite Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="expiry">Expires in (days)</Label>
              <Input
                id="expiry"
                type="number"
                min="1"
                max="365"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                placeholder="30"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerate} disabled={generating}>
                <Plus className="h-4 w-4 mr-2" />
                Generate Invite
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invite Codes ({invites.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Used At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell className="font-mono font-bold">{invite.code}</TableCell>
                  <TableCell>{getStatusBadge(invite)}</TableCell>
                  <TableCell>{new Date(invite.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(invite.expires_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {invite.used_at ? new Date(invite.used_at).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(invite.code)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
