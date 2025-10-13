import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Invite {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export const useInvites = () => {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchInvites = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const generateInvite = async (expiresInDays: number = 30) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate a random invite code
      const code = Array.from({ length: 8 }, () =>
        Math.random().toString(36).charAt(2).toUpperCase()
      ).join('');

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      const { error } = await supabase.from('invites').insert({
        code,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Invite code generated successfully',
      });

      await fetchInvites();
      return code;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const validateInvite = async (code: string, email: string): Promise<{ valid: boolean; error?: string; bypass?: boolean }> => {
    try {
      const { data, error } = await supabase.rpc('validate_and_consume_invite', {
        p_code: code,
        p_email: email,
      });

      if (error) throw error;
      return data as { valid: boolean; error?: string; bypass?: boolean };
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  };

  const linkInviteToUser = async (code: string, userId: string) => {
    try {
      const { error } = await supabase.rpc('link_invite_to_user', {
        p_code: code,
        p_user_id: userId,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Error linking invite:', error);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  return {
    invites,
    loading,
    generateInvite,
    validateInvite,
    linkInviteToUser,
    refreshInvites: fetchInvites,
  };
};
