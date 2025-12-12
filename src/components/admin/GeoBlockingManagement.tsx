import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// US States list for dropdown
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' }
];

interface BlockedState {
  id: string;
  state_code: string;
  state_name: string;
  reason: string | null;
  is_active: boolean;
  blocked_at: string;
}

export const GeoBlockingManagement = () => {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStateCode, setNewStateCode] = useState('');
  const [newReason, setNewReason] = useState('');

  const { data: blockedStates, isLoading } = useQuery({
    queryKey: ['admin-blocked-states'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_states')
        .select('*')
        .order('state_name');
      
      if (error) throw error;
      return data as BlockedState[];
    }
  });

  const addStateMutation = useMutation({
    mutationFn: async ({ stateCode, reason }: { stateCode: string; reason: string }) => {
      const stateName = US_STATES.find(s => s.code === stateCode)?.name || stateCode;
      
      const { error } = await supabase
        .from('blocked_states')
        .insert({
          state_code: stateCode,
          state_name: stateName,
          reason: reason || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-states'] });
      setShowAddDialog(false);
      setNewStateCode('');
      setNewReason('');
      toast.success('State added to blocked list');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('This state is already in the blocked list');
      } else {
        toast.error(`Failed to add state: ${error.message}`);
      }
    }
  });

  const toggleStateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('blocked_states')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-states'] });
      toast.success('State blocking status updated');
    },
    onError: (error) => {
      toast.error(`Failed to update state: ${error.message}`);
    }
  });

  const deleteStateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('blocked_states')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-states'] });
      toast.success('State removed from blocked list');
    },
    onError: (error) => {
      toast.error(`Failed to remove state: ${error.message}`);
    }
  });

  const availableStates = US_STATES.filter(
    state => !blockedStates?.some(bs => bs.state_code === state.code)
  );

  const activeCount = blockedStates?.filter(s => s.is_active).length || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Geo-Blocking Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Geo-Blocking Management
            </CardTitle>
            <CardDescription>
              Manage states where the platform is restricted due to regulatory requirements
            </CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add State
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block a State</DialogTitle>
                <DialogDescription>
                  Add a state to the geo-blocking list. Users from this state will be unable to access the platform.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <select
                    id="state"
                    value={newStateCode}
                    onChange={(e) => setNewStateCode(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select a state...</option>
                    {availableStates.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name} ({state.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input
                    id="reason"
                    placeholder="e.g., Strict gambling laws"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => addStateMutation.mutate({ stateCode: newStateCode, reason: newReason })}
                    disabled={!newStateCode || addStateMutation.isPending}
                  >
                    {addStateMutation.isPending ? 'Adding...' : 'Add State'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{blockedStates?.length || 0} states in list</span>
          <span>•</span>
          <span className="text-destructive">{activeCount} actively blocked</span>
        </div>

        {blockedStates?.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            No states are currently blocked. The platform is accessible from all US states.
          </p>
        ) : (
          <div className="space-y-2">
            {blockedStates?.map((state) => (
              <div
                key={state.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  state.is_active ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MapPin className={`h-4 w-4 ${state.is_active ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{state.state_name}</span>
                      <Badge variant="outline" className="text-xs">{state.state_code}</Badge>
                      {!state.is_active && (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                    {state.reason && (
                      <p className="text-xs text-muted-foreground">{state.reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`toggle-${state.id}`} className="text-xs text-muted-foreground">
                      {state.is_active ? 'Blocking' : 'Disabled'}
                    </Label>
                    <Switch
                      id={`toggle-${state.id}`}
                      checked={state.is_active}
                      onCheckedChange={(checked) => 
                        toggleStateMutation.mutate({ id: state.id, isActive: checked })
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteStateMutation.mutate(state.id)}
                    disabled={deleteStateMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm">How Geo-Blocking Works</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Users are detected by IP address on first visit</li>
            <li>• If in a blocked state, they see an access restriction overlay</li>
            <li>• Inactive states in this list are not blocked</li>
            <li>• Changes take effect immediately for new visitors</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
